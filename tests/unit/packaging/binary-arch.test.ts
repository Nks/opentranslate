import {
  describe, expect, it,
} from 'vitest'
import {
  readFileSync,
} from 'node:fs'
import {
  resolve,
} from 'node:path'
import {
  assessBinaryTarget,
  detectBinaryArch,
  type ArchAssessment,
  type BinaryArchInfo,
} from '@scripts/packaging/binary-arch'

const rootDir: string = resolve(__dirname, '..', '..', '..')
const uiohookPrebuildsDir: string = resolve(rootDir, 'node_modules', 'uiohook-napi', 'prebuilds')

const MACH_O_64_MAGIC: number = 0xfeedfacf
const MACH_O_FAT_MAGIC: number = 0xcafebabe
const MACH_O_FAT_64_MAGIC: number = 0xcafebabf
const CPU_TYPE_X86_64: number = 0x01000007
const CPU_TYPE_ARM64: number = 0x0100000c
const PE_OFFSET: number = 0x80

function thinMachO(cpuType: number): Uint8Array {
  const bytes: Uint8Array = new Uint8Array(32)
  const view: DataView = new DataView(bytes.buffer)
  view.setUint32(0, MACH_O_64_MAGIC, true)
  view.setInt32(4, cpuType, true)

  return bytes
}

function fatMachO(cpuTypes: readonly number[], magic: number = MACH_O_FAT_MAGIC): Uint8Array {
  const entrySize: number = magic === MACH_O_FAT_64_MAGIC ? 32 : 20
  const bytes: Uint8Array = new Uint8Array(8 + (cpuTypes.length * entrySize))
  const view: DataView = new DataView(bytes.buffer)
  view.setUint32(0, magic, false)
  view.setUint32(4, cpuTypes.length, false)
  cpuTypes.forEach((cpuType: number, index: number): void => {
    view.setInt32(8 + (index * entrySize), cpuType, false)
  })

  return bytes
}

function portableExecutable(machine: number): Uint8Array {
  const bytes: Uint8Array = new Uint8Array(PE_OFFSET + 8)
  const view: DataView = new DataView(bytes.buffer)
  bytes.set([0x4d, 0x5a], 0)
  view.setUint32(0x3c, PE_OFFSET, true)
  bytes.set([0x50, 0x45, 0x00, 0x00], PE_OFFSET)
  view.setUint16(PE_OFFSET + 4, machine, true)

  return bytes
}

function elf(machine: number, littleEndian: boolean = true): Uint8Array {
  const bytes: Uint8Array = new Uint8Array(64)
  const view: DataView = new DataView(bytes.buffer)
  bytes.set([0x7f, 0x45, 0x4c, 0x46, 0x02, littleEndian ? 0x01 : 0x02], 0)
  view.setUint16(18, machine, littleEndian)

  return bytes
}

function readPrebuild(platformArch: string): Uint8Array {
  return readFileSync(resolve(uiohookPrebuildsDir, platformArch, 'uiohook-napi.node'))
}

describe('detectBinaryArch — Mach-O', () => {
  it('reads arm64 from a thin 64-bit Mach-O header', () => {
    expect(detectBinaryArch(thinMachO(CPU_TYPE_ARM64))).toEqual({
      format: 'mach-o',
      arches: ['arm64'],
    })
  })

  it('reads x64 from a thin 64-bit Mach-O header', () => {
    expect(detectBinaryArch(thinMachO(CPU_TYPE_X86_64))).toEqual({
      format: 'mach-o',
      arches: ['x64'],
    })
  })

  it('lists every slice of a universal (fat) Mach-O binary', () => {
    expect(detectBinaryArch(fatMachO([CPU_TYPE_X86_64, CPU_TYPE_ARM64]))).toEqual({
      format: 'mach-o-universal',
      arches: ['x64', 'arm64'],
    })
  })

  it('lists every slice of a 64-bit universal Mach-O binary', () => {
    const header: Uint8Array = fatMachO([CPU_TYPE_ARM64], MACH_O_FAT_64_MAGIC)

    expect(detectBinaryArch(header)).toEqual({
      format: 'mach-o-universal',
      arches: ['arm64'],
    })
  })

  it('rejects a Java class file that shares the fat magic', () => {
    const javaClass: Uint8Array = new Uint8Array([0xca, 0xfe, 0xba, 0xbe, 0x00, 0x00, 0x00, 0x41])

    expect(() => detectBinaryArch(javaClass)).toThrow(/universal/i)
  })
})

describe('detectBinaryArch — PE', () => {
  it('reads x64 from the COFF machine field', () => {
    expect(detectBinaryArch(portableExecutable(0x8664))).toEqual({
      format: 'pe',
      arches: ['x64'],
    })
  })

  it('reads arm64 from the COFF machine field', () => {
    expect(detectBinaryArch(portableExecutable(0xaa64))).toEqual({
      format: 'pe',
      arches: ['arm64'],
    })
  })

  it('reads ia32 from the COFF machine field', () => {
    expect(detectBinaryArch(portableExecutable(0x014c)).arches).toEqual(['ia32'])
  })

  it('rejects an MZ stub without a PE signature', () => {
    const header: Uint8Array = portableExecutable(0x8664)
    header.set([0x00, 0x00], PE_OFFSET)

    expect(() => detectBinaryArch(header)).toThrow(/PE signature/)
  })
})

describe('detectBinaryArch — ELF', () => {
  it('reads x64 from e_machine', () => {
    expect(detectBinaryArch(elf(62))).toEqual({
      format: 'elf',
      arches: ['x64'],
    })
  })

  it('reads arm64 from e_machine', () => {
    expect(detectBinaryArch(elf(183))).toEqual({
      format: 'elf',
      arches: ['arm64'],
    })
  })

  it('honours big-endian ELF data encoding', () => {
    expect(detectBinaryArch(elf(183, false)).arches).toEqual(['arm64'])
  })
})

describe('detectBinaryArch — invalid input', () => {
  it('labels an unknown machine code instead of guessing', () => {
    expect(detectBinaryArch(elf(0x1234)).arches).toEqual(['unknown-0x1234'])
  })

  it('rejects an unrecognised header', () => {
    expect(() => detectBinaryArch(new Uint8Array([0x23, 0x21, 0x2f, 0x62]))).toThrow(/Unrecognised/)
  })

  it('rejects a header too short to hold the machine field', () => {
    expect(() => detectBinaryArch(new Uint8Array([0x7f, 0x45, 0x4c, 0x46]))).toThrow(/truncated/i)
  })
})

describe('detectBinaryArch — real uiohook-napi prebuilds', () => {
  it.each([
    ['darwin-arm64', 'mach-o', 'arm64'],
    ['darwin-x64', 'mach-o', 'x64'],
    ['win32-x64', 'pe', 'x64'],
    ['win32-arm64', 'pe', 'arm64'],
    ['linux-x64', 'elf', 'x64'],
  ])('identifies prebuilds/%s as %s %s', (platformArch: string, format: string, arch: string) => {
    expect(detectBinaryArch(readPrebuild(platformArch))).toEqual({
      format,
      arches: [arch],
    })
  })
})

describe('assessBinaryTarget', () => {
  it('accepts a thin binary of the expected format and arch', () => {
    const info: BinaryArchInfo = detectBinaryArch(thinMachO(CPU_TYPE_ARM64))
    const assessment: ArchAssessment = assessBinaryTarget(info, {
      platform: 'mac',
      arch: 'arm64',
    })

    expect(assessment).toEqual({
      matches: true,
      detail: 'mach-o arm64',
    })
  })

  it('rejects a thin binary of another arch and names both sides', () => {
    const assessment: ArchAssessment = assessBinaryTarget(detectBinaryArch(elf(62)), {
      platform: 'linux',
      arch: 'arm64',
    })

    expect(assessment).toEqual({
      matches: false,
      detail: 'expected linux arm64, found elf x64',
    })
  })

  it('rejects a binary built for another platform even when the arch matches', () => {
    const info: BinaryArchInfo = detectBinaryArch(portableExecutable(0x8664))
    const assessment: ArchAssessment = assessBinaryTarget(info, {
      platform: 'linux',
      arch: 'x64',
    })

    expect(assessment).toEqual({
      matches: false,
      detail: 'expected linux x64, found pe x64',
    })
  })

  it('accepts a universal binary that contains the expected slice', () => {
    const info: BinaryArchInfo = detectBinaryArch(fatMachO([CPU_TYPE_X86_64, CPU_TYPE_ARM64]))

    expect(assessBinaryTarget(info, {
      platform: 'mac',
      arch: 'x64',
    }).matches).toBe(true)
  })

  it('rejects a universal binary that lacks the expected slice', () => {
    const info: BinaryArchInfo = detectBinaryArch(fatMachO([CPU_TYPE_ARM64]))

    expect(assessBinaryTarget(info, {
      platform: 'mac',
      arch: 'x64',
    })).toEqual({
      matches: false,
      detail: 'expected mac x64, found mach-o-universal arm64',
    })
  })
})
