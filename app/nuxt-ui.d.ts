/**
 * Ambient declarations for Nuxt UI auto-imports.
 *
 * At build time Nuxt generates these as global helpers via its
 * auto-import system. Outside the Nuxt build context (e.g. plain
 * `tsc --noEmit`) the globals do not exist — this file fills the gap.
 */

interface ToastOptions {
  title?: string
  description?: string
  color?: string
}

interface Toast {
  add: (options: ToastOptions) => void
}

declare function useToast(): Toast
