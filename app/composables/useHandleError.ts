import { useToast } from '#imports'

export function useHandleError() {
  const toast = useToast()

  return (err: unknown) => {
    toast.add({
      title: 'Error',
      description: err instanceof Error ? err.message : String(err),
      color: 'error',
    })
  }
}
