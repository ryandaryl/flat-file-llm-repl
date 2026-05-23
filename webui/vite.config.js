import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Directs any request starting with these paths to the backend
      '/start-task': 'http://localhost:8000',
      '/task-status': 'http://localhost:8000',
    }
  }
})
