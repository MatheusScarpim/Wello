import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  envDir: '..',
  plugins: [vue()],
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
