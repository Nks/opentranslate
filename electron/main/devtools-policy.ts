import { app } from 'electron'

export function isDevToolsAllowed(): boolean {
  return !app.isPackaged || process.env.OPENTRANSLATE_DEVTOOLS === '1'
}
