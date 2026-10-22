import type {
  PackageArch,
  PackageRequest,
} from '@scripts/packaging/targets'

const BUILD_COMMANDS: readonly string[] = ['pnpm run build:electron', 'pnpm run build:renderer']

function builderCommand(request: PackageRequest, arch: PackageArch): string {
  const dirFlag: string = request.dirOnly ? ' --dir' : ''

  return `pnpm exec electron-builder --${request.platform} --${arch} --publish never${dirFlag}`
}

export function planPackageCommands(request: PackageRequest): string[] {
  if (request.arches.length === 0) {
    throw new Error('planPackageCommands needs at least one arch')
  }

  const builderCommands: string[] = request.arches.map(
    (arch: PackageArch): string => builderCommand(request, arch),
  )

  return [...BUILD_COMMANDS, ...builderCommands]
}
