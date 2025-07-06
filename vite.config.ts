import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Directly expose the API_KEY from the build environment to the client code.
    // This is the most reliable way to handle system-level environment variables.
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  },
})
