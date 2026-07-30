import { defineConfig } from 'vite'
import { resolve } from 'path'

// Multi-page: the main site + the standalone Top Down View. Both are static,
// so this still deploys straight to GitHub Pages.
export default defineConfig({
  base: '/Portfolio/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        topdown: resolve(__dirname, 'topdown.html'),
      },
    },
  },
})
