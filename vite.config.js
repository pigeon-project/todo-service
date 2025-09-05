import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8000,
    strictPort: true
  },
  preview: {
    port: 8000,
    strictPort: true
  }
})

