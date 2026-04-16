import {
  defineNuxtConfig,
} from 'nuxt/config'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-04-01',
  srcDir: 'app/',
  ssr: false,
  devtools: {
    enabled: true,
  },
  modules: ['@nuxt/ui', '@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'OpenTranslate Desktop',
      meta: [{
        charset: 'utf-8',
      }, {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      }],
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
  // Workaround for Nuxt 4.4.2 bug: @nuxt/nitro-server duplicates the
  // `useAppConfig` auto-import when serverAppConfig is enabled (see
  // nuxt/nuxt#34812). We are SSR-off and do not use server app config, so
  // disabling the experimental flag silences the warn cleanly.
  experimental: {
    serverAppConfig: false,
  },
  vite: {
    resolve: {
      alias: {
        '@shared': new URL('./shared', import.meta.url).pathname,
        '@electron': new URL('./electron', import.meta.url).pathname,
        '@app': new URL('./app', import.meta.url).pathname,
      },
    },
    server: {
      strictPort: true,
    },
  },
})
