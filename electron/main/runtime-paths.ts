import { join } from 'node:path'

export interface RuntimePaths {
  preloadPath: string
  distElectronDir: string
  rendererEntry: string
  smokeEntry: string
  trayIconBaseDir: string
}

export function resolveRuntimePaths(distElectronDir: string): RuntimePaths {
  return {
    preloadPath: join(distElectronDir, 'preload.cjs'),
    distElectronDir,
    rendererEntry: join(distElectronDir, '..', '.output/public/index.html'),
    smokeEntry: join(distElectronDir, 'smoke.html'),
    trayIconBaseDir: join(distElectronDir, '..', 'build', 'icons', 'tray'),
  }
}
