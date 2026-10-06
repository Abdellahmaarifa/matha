import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@matcha/ui': path.resolve(import.meta.dirname, '../../packages/ui/src'),
      '@matcha/api-client': path.resolve(import.meta.dirname, '../../packages/api-client/src'),
    },
  },
  server: {
    port: 5173,
    // allow ngrok tunnels (the subdomain changes on every ngrok restart)
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app'],
    // Same-origin API: the browser calls /api/... on this server and Vite
    // forwards it, so the app works through a tunnel and needs no CORS.
    proxy: {
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:8000',
    },
  },
})
