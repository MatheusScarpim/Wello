import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  envDir: '..',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo_192x192-sem-fundo.png', 'logo_192x192.png'],
      manifest: {
        name: 'ScarlatChat - Painel de Atendimento',
        short_name: 'ScarlatChat',
        description: 'Painel de atendimento ScarlatChat',
        theme_color: '#36B5A0',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'logo_192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https?:\/\/.*\/uploads\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'uploads-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 3000,
    allowedHosts: 'all',
    proxy: {
      '/api': {
        target: 'http://20.109.17.147:8091',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://20.109.17.147:8091',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://20.109.17.147:8091',
        changeOrigin: true,
      },
      '/status': {
        target: 'http://20.109.17.147:8091',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4176,
    allowedHosts: 'all',
    proxy: {
      '/api': {
        target: 'http://20.109.17.147:8091',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://20.109.17.147:8091',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://20.109.17.147:8091',
        changeOrigin: true,
      },
      '/status': {
        target: 'http://20.109.17.147:8091',
        changeOrigin: true,
      },
    },
  },
})
