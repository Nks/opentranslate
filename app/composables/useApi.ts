import type {
  OpenTranslateApi,
} from '@electron/preload/index'

export function useApi(): OpenTranslateApi {
  if (typeof window === 'undefined' || !('api' in window)) {
    throw new Error('useApi: window.api is not available outside Electron')
  }

  return (window as unknown as {
    api: OpenTranslateApi
  }).api
}
