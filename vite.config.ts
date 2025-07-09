import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Vite replaces this with the actual value at build time.
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
})
