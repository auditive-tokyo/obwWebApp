import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'fs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-404',
      closeBundle() {
        const indexPath = 'dist/index.html'
        const notFoundPath = 'dist/404.html'
        if (existsSync(indexPath)) {
          copyFileSync(indexPath, notFoundPath)
        }
      }
    }
  ],
  base: '/obwWebApp/',
  build: {
    outDir: 'dist',
  },
})
