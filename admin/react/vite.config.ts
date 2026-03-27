import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../public/react-dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'saas-dashboard.js',
        chunkFileNames: 'saas-dashboard-[hash].js',
        assetFileNames: 'saas-dashboard.[ext]',
      },
    },
  },
  base: '/admin/react-dist/',
})
