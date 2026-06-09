import {
  useApi,
} from '@app/composables/useApi'

export function useResetLocalData() {
  const api = useApi()
  // eslint-disable-next-line no-undef -- Nuxt UI auto-import; no package export available
  const toast = useToast()

  async function resetLocalData(): Promise<boolean> {
    try {
      await api.settings.reset()
      toast.add({
        title: 'Local data reset',
        description:
          'Stored settings cleared. History and keychain credentials were not affected.',
        color: 'success',
      })

      return true
    } catch (err: unknown) {
      toast.add({
        title: 'Reset failed',
        description: err instanceof Error ? err.message : String(err),
        color: 'error',
      })

      return false
    }
  }

  return {
    resetLocalData,
  }
}
