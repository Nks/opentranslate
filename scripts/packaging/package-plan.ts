import type {
  PackageArch,
  PackageRequest,
} from '@scripts/packaging/targets'

const BUILD_COMMANDS: readonly string[] = ['pnpm run build:electron', 'pnpm run build:renderer']

function nativeRebuildCommand(arch: string): string {
  return `pnpm exec electron-rebuild -f -o better-sqlite3 --arch=${arch}`
}

function builderCommand(request: PackageRequest, arch: PackageArch): string {
  const dirFlag: string = request.dirOnly ? ' --dir' : ''

  return `pnpm exec electron-builder --${request.platform} --${arch} --publish never${dirFlag}`
}

export function planPackageCommands(
  request: PackageRequest,
  hostArch: NodeJS.Architecture,
): string[] {
  const lastArch: PackageArch | undefined = request.arches.at(-1)

  if (lastArch === undefined) {
    throw new Error('planPackageCommands needs at least one arch')
  }

  const perArchCommands: string[] = request.arches.flatMap(
    (arch: PackageArch): string[] => [nativeRebuildCommand(arch), builderCommand(request, arch)],
  )
  const restoreCommands: string[] = lastArch === hostArch ? [] : [nativeRebuildCommand(hostArch)]

  return [...BUILD_COMMANDS, ...perArchCommands, ...restoreCommands]
}
