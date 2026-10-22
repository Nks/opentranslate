/**
 * Composable that returns a handler for surfacing errors to the user
 * via Nuxt UI toast notifications.
 *
 * Import and call at the top of any composable or `<script setup>` block,
 * then pass caught errors to the returned function instead of
 * swallowing them silently.
 */
export function useHandleError() {
  // eslint-disable-next-line no-undef -- Nuxt UI auto-import; no package export available
  const toast = useToast()

  return (err: unknown) => {
    toast.add({
      title: 'Error',
      description: err instanceof Error ? err.message : String(err),
      color: 'error',
    })
  }
}
