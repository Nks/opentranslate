import type {
  PackageArch,
  PackagePlatform,
  PackageTarget,
} from './targets.ts'

export type BinaryFormat = 'mach-o' | 'mach-o-universal' | 'pe' | 'elf'
export type KnownArch = 'x64' | 'arm64' | 'ia32' | 'arm'
export type DetectedArch = KnownArch | `unknown-0x${string}`

export interface BinaryArchInfo {
  format: BinaryFormat
  arches: readonly DetectedArch[]
}

export interface ArchAssessment {
  matches: boolean
  detail: string
}

export const BINARY_HEADER_BYTES: number = 4096

const PLATFORM_FORMATS: Readonly<Record<PackagePlatform, readonly BinaryFormat[]>> = {
  mac: ['mach-o', 'mach-o-universal'],
  win: ['pe'],
  linux: ['elf'],
}

const MACH_O_CPU_TYPES: ReadonlyMap<number, KnownArch> = new Map<number, KnownArch>([
  [0x01000007, 'x64'],
  [0x0100000c, 'arm64'],
  [0x00000007, 'ia32'],
  [0x0000000c, 'arm'],
])

const PE_MACHINES: ReadonlyMap<number, KnownArch> = new Map<number, KnownArch>([
  [0x8664, 'x64'],
  [0xaa64, 'arm64'],
  [0x014c, 'ia32'],
  [0x01c4, 'arm'],
])

const ELF_MACHINES: ReadonlyMap<number, KnownArch> = new Map<number, KnownArch>([
  [62, 'x64'],
  [183, 'arm64'],
  [3, 'ia32'],
  [40, 'arm'],
])

const MACH_O_THIN_MAGICS: ReadonlySet<number> = new Set<number>([0xfeedfacf, 0xfeedface])
const MACH_O_FAT_MAGIC: number = 0xcafebabe
const MACH_O_FAT_64_MAGIC: number = 0xcafebabf
const MACH_O_MAX_FAT_SLICES: number = 32
const ELF_MAGIC: number = 0x7f454c46
const ELF_LITTLE_ENDIAN: number = 1
const ELF_BIG_ENDIAN: number = 2
const PE_HEADER_POINTER_OFFSET: number = 0x3c
const PE_SIGNATURE: readonly number[] = [0x50, 0x45, 0x00, 0x00]

function nameArch(table: ReadonlyMap<number, KnownArch>, code: number): DetectedArch {
  return table.get(code) ?? `unknown-0x${code.toString(16)}`
}

function requireBytes(header: Uint8Array, length: number, format: BinaryFormat): void {
  if (header.length < length) {
    throw new Error(`Truncated ${format} header: need ${length} bytes, got ${header.length}`)
  }
}

function readThinMachO(header: Uint8Array, view: DataView, littleEndian: boolean): BinaryArchInfo {
  requireBytes(header, 8, 'mach-o')

  return {
    format: 'mach-o',
    arches: [nameArch(MACH_O_CPU_TYPES, view.getUint32(4, littleEndian))],
  }
}

function readFatMachO(header: Uint8Array, view: DataView, is64: boolean): BinaryArchInfo {
  requireBytes(header, 8, 'mach-o-universal')
  const sliceCount: number = view.getUint32(4, false)

  if (sliceCount === 0 || sliceCount > MACH_O_MAX_FAT_SLICES) {
    throw new Error(`Not a Mach-O universal binary: implausible slice count ${sliceCount}`)
  }

  const entrySize: number = is64 ? 32 : 20
  requireBytes(header, 8 + (sliceCount * entrySize), 'mach-o-universal')
  const arches: DetectedArch[] = Array.from(
    { length: sliceCount },
    (_unused: unknown, index: number): DetectedArch =>
      nameArch(MACH_O_CPU_TYPES, view.getUint32(8 + (index * entrySize), false)),
  )

  return {
    format: 'mach-o-universal',
    arches,
  }
}

function readPortableExecutable(header: Uint8Array, view: DataView): BinaryArchInfo {
  requireBytes(header, PE_HEADER_POINTER_OFFSET + 4, 'pe')
  const peOffset: number = view.getUint32(PE_HEADER_POINTER_OFFSET, true)
  requireBytes(header, peOffset + 6, 'pe')
  const hasSignature: boolean = PE_SIGNATURE.every(
    (byte: number, index: number): boolean => header[peOffset + index] === byte,
  )

  if (!hasSignature) {
    throw new Error(`Missing PE signature at 0x${peOffset.toString(16)}`)
  }

  return {
    format: 'pe',
    arches: [nameArch(PE_MACHINES, view.getUint16(peOffset + 4, true))],
  }
}

function readElf(header: Uint8Array, view: DataView): BinaryArchInfo {
  requireBytes(header, 20, 'elf')
  const dataEncoding: number | undefined = header[5]

  if (dataEncoding !== ELF_LITTLE_ENDIAN && dataEncoding !== ELF_BIG_ENDIAN) {
    throw new Error(`Invalid ELF data encoding: ${String(dataEncoding)}`)
  }

  return {
    format: 'elf',
    arches: [nameArch(ELF_MACHINES, view.getUint16(18, dataEncoding === ELF_LITTLE_ENDIAN))],
  }
}

export function detectBinaryArch(header: Uint8Array): BinaryArchInfo {
  if (header.length < 4) {
    throw new Error(`Unrecognised binary header: only ${header.length} bytes`)
  }

  const view: DataView = new DataView(header.buffer, header.byteOffset, header.byteLength)
  const bigEndianMagic: number = view.getUint32(0, false)
  const isPortableExecutable: boolean = header[0] === 0x4d && header[1] === 0x5a

  if (bigEndianMagic === MACH_O_FAT_MAGIC || bigEndianMagic === MACH_O_FAT_64_MAGIC) {
    return readFatMachO(header, view, bigEndianMagic === MACH_O_FAT_64_MAGIC)
  }

  if (MACH_O_THIN_MAGICS.has(view.getUint32(0, true))) {
    return readThinMachO(header, view, true)
  }

  if (MACH_O_THIN_MAGICS.has(bigEndianMagic)) {
    return readThinMachO(header, view, false)
  }

  if (isPortableExecutable) {
    return readPortableExecutable(header, view)
  }

  if (bigEndianMagic === ELF_MAGIC) {
    return readElf(header, view)
  }

  throw new Error(`Unrecognised binary header: 0x${bigEndianMagic.toString(16).padStart(8, '0')}`)
}

function archMatches(info: BinaryArchInfo, expected: PackageArch): boolean {
  if (info.format === 'mach-o-universal') {
    return info.arches.includes(expected)
  }

  return info.arches.length === 1 && info.arches[0] === expected
}

export function assessBinaryTarget(info: BinaryArchInfo, target: PackageTarget): ArchAssessment {
  const found: string = `${info.format} ${info.arches.join('+')}`
  const formatMatches: boolean = PLATFORM_FORMATS[target.platform].includes(info.format)
  const matches: boolean = formatMatches && archMatches(info, target.arch)

  return {
    matches,
    detail: matches ? found : `expected ${target.platform} ${target.arch}, found ${found}`,
  }
}
