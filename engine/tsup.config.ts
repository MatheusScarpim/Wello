import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/new_server.ts'],
  format: ['cjs'],
  target: 'es2022',
  outDir: 'dist',
  clean: true,
  sourcemap: false,
  minify: false,
  bundle: true,
  skipNodeModulesBundle: true,
  noExternal: [],
  external: [
    // Node modules externos
    'express',
    'axios',
    'mongodb',
    'bcrypt',
    'body-parser',
    'cors',
    'dotenv',
    'ejs',
    'form-data',
    'jsonwebtoken',
    'moment',
    'multer',
    'socket.io',
    'swagger-ui-express',
    '@wppconnect-team/wppconnect',
    '@ffmpeg/core',
    '@ffmpeg/ffmpeg',
    'ffmpeg.js',
    'fluent-ffmpeg',
    'google-libphonenumber',
    'sharp',
  ],
  esbuildOptions(options) {
    // Resolve alias @/
    options.alias = {
      '@': './src',
    }
  },
})
