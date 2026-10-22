import {
  defineStore,
} from 'pinia'
import type {
  AppSettings,
} from '@shared/types/settings'
import {
  defaultAppSettings,
} from '@shared/schemas/settings'

export const useSettingsStore = defineStore('settings', {
  state: (): {
    app: AppSettings
  } => ({
    app: {
      ...defaultAppSettings,
    },
  }),
})
