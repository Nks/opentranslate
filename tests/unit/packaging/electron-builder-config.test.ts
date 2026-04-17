import {
  describe, expect, it,
} from 'vitest'
import {
  readFileSync, existsSync,
} from 'node:fs'
import {
  resolve,
} from 'node:path'
import {
  parse as yamlParse,
} from 'yaml'

const rootDir = resolve(__dirname, '..', '..', '..')
const configPath = resolve(rootDir, 'electron-builder.yml')

function loadConfig(): Record<string, unknown> {
  const raw = readFileSync(configPath, 'utf8')

  return yamlParse(raw) as Record<string, unknown>
}

describe('electron-builder.yml', () => {
  it('config file exists', () => {
    expect(existsSync(configPath)).toBe(true)
  })

  it('has correct appId', () => {
    const config = loadConfig()

    expect(config.appId).toBe('com.opentranslate.desktop')
  })

  it('has correct product name', () => {
    const config = loadConfig()

    expect(config.productName).toBe('OpenTranslate Desktop')
  })

  it('includes dist-electron and .output/public in files', () => {
    const config = loadConfig()
    const files = config.files as string[]

    expect(files).toContain('dist-electron/**/*')
    expect(files).toContain('.output/public/**/*')
    expect(files).toContain('package.json')
  })

  it('asar is enabled', () => {
    const config = loadConfig()

    expect(config.asar).toBe(true)
  })

  it('native modules unpacked from asar', () => {
    const config = loadConfig()
    const unpack = config.asarUnpack as string[]

    expect(unpack).toContain('**/*.{node,dll}')
  })

  it('uiohook-napi + node-gyp-build unpacked from asar', () => {
    const config = loadConfig()
    const unpack = config.asarUnpack as string[]

    expect(unpack).toContain('**/node_modules/uiohook-napi/**')
    expect(unpack).toContain('**/node_modules/node-gyp-build/**')
  })

  it('npmRebuild is enabled for native modules', () => {
    const config = loadConfig()

    expect(config.npmRebuild).toBe(true)
  })

  it('mac target is DMG with x64 + arm64', () => {
    const config = loadConfig()
    const mac = config.mac as Record<string, unknown>
    const targets = mac.target as Array<{
      target: string
      arch: string[]
    }>
    expect(targets).toHaveLength(1)

    const first = targets[0]!

    expect(first.target).toBe('dmg')
    expect(first.arch).toContain('x64')
    expect(first.arch).toContain('arm64')
  })

  it('mac identity is null (unsigned local builds)', () => {
    const config = loadConfig()
    const mac = config.mac as Record<string, unknown>

    expect(mac.identity).toBeNull()
  })

  it('win targets include nsis and zip', () => {
    const config = loadConfig()
    const win = config.win as Record<string, unknown>
    const targets = win.target as Array<{ target: string }>
    const targetNames = targets.map((item) => item.target)

    expect(targetNames).toContain('nsis')
    expect(targetNames).toContain('zip')
  })

  it('linux targets include AppImage and deb', () => {
    const config = loadConfig()
    const linux = config.linux as Record<string, unknown>
    const targets = linux.target as Array<{ target: string }>
    const targetNames = targets.map((item) => item.target)

    expect(targetNames).toContain('AppImage')
    expect(targetNames).toContain('deb')
  })

  it('nsis allows installation directory change', () => {
    const config = loadConfig()
    const nsis = config.nsis as Record<string, unknown>

    expect(nsis.allowToChangeInstallationDirectory).toBe(true)
    expect(nsis.oneClick).toBe(false)
  })
})

describe('build resources', () => {
  it('entitlements plist exists', () => {
    expect(existsSync(resolve(rootDir, 'build/entitlements.mac.plist'))).toBe(true)
  })

  it('icon.png exists', () => {
    expect(existsSync(resolve(rootDir, 'build/icon.png'))).toBe(true)
  })
})

describe('package.json packaging fields', () => {
  it('main points to dist-electron/main.cjs', () => {
    const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'))

    expect(pkg.main).toBe('dist-electron/main.cjs')
  })

  it('has package script', () => {
    const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'))

    expect(pkg.scripts.package).toBeDefined()
    expect(pkg.scripts.package).not.toContain('echo')
  })

  it('has package:dir script', () => {
    const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'))

    expect(pkg.scripts['package:dir']).toBeDefined()
    expect(pkg.scripts['package:dir']).toContain('--dir')
  })

  it('better-sqlite3 is in dependencies (not devDependencies)', () => {
    const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'))

    expect(pkg.dependencies['better-sqlite3']).toBeDefined()
  })

  it('uiohook-napi is in dependencies (for global key observer)', () => {
    const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'))

    expect(pkg.dependencies['uiohook-napi']).toBeDefined()
  })

  it('electron is in devDependencies (not bundled)', () => {
    const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'))

    expect(pkg.devDependencies.electron).toBeDefined()
    expect(pkg.dependencies?.electron).toBeUndefined()
  })
})
