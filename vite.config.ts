import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': new URL('./src', (import.meta as ImportMeta & { url: string }).url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
    },
  },
  server: {
    proxy: {
      '/api/auth': 'http://127.0.0.1:8787',
      '/api/patients': 'http://127.0.0.1:8787',
      '/api/tests': 'http://127.0.0.1:8787',
      '/api/orders': 'http://127.0.0.1:8787',
      '/api/masters': 'http://127.0.0.1:8787',
      '/api/attendance': 'http://127.0.0.1:8787',
      '/api/invoices': 'http://127.0.0.1:8787',
      '/api/inventory': 'http://127.0.0.1:8787',
      '/api/import-bills': 'http://127.0.0.1:8787',
      '/api/reports': 'http://127.0.0.1:8787',
      '/api/revenue': 'http://127.0.0.1:8787',
      '/api/health': 'http://127.0.0.1:3001',
      '/api/interpret': 'http://127.0.0.1:3001',
    },
  },
})
