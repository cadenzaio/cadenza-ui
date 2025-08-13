// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  modules: ['nuxt-quasar-ui', '@pinia/nuxt', '@sidebase/nuxt-auth'],
  css: [
    '@quasar/extras/material-icons/material-icons.css',
    'quasar/src/css/index.sass',
    '@vue-flow/core/dist/style.css',
    '@vue-flow/core/dist/theme-default.css',
  ],
  ssr: false,
  build: {
    transpile: ['quasar'],
  },
  quasar: {
    plugins: ['Dialog', 'Notify', 'Dark'],
    cssAddon: true,
  },
});
