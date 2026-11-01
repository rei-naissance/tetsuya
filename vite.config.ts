import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative base so the built site works from any static host or sub-folder.
  base: './',
  plugins: [react(), tailwindcss()],
})
