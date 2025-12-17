import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    sourcemap: true, // Ensure source maps are generated for production builds
    outDir: 'dist',
    emptyOutDir: true,
  },
});
