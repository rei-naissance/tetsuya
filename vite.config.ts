import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Absolute site address for the link-preview image in index.html. On Vercel
// it comes from the production domain; set VITE_SITE_URL to override.
process.env.VITE_SITE_URL ??= process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : ''

export default defineConfig({
  // Relative base so the built site works from any static host or sub-folder.
  base: './',
  plugins: [react(), tailwindcss()],
})
