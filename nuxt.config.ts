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
  modules: ['@nuxt/ui', '@pinia/nuxt', '@vueuse/nuxt', '@nuxt/fonts'],
  css: ['~/assets/css/main.css'],
  icon: {
    // Only use locally-bundled Fluent icons. No external API requests.
    provider: 'server',
    serverBundle: 'local',
    collections: ['fluent'],
  },
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
  experimental: {
    serverAppConfig: false,
    viteEnvironmentApi: true,
  },
  vite: {
    resolve: {
      alias: {
        '@shared': new URL('./shared', import.meta.url).pathname,
        '@electron': new URL('./electron', import.meta.url).pathname,
        '@app': new URL('./app', import.meta.url).pathname,
      },
    },
    optimizeDeps: {
      include: [
        'zod',
        'pinia',
        'vue',
        '@vueuse/core',
      ],
    },
    server: {
      strictPort: true,
    },
  },
})
