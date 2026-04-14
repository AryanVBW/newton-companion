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
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    // Tauri supports modern targets
    target: ['es2021', 'chrome105', 'safari13'],
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react'
          if (id.includes('node_modules/framer-motion')) return 'vendor-motion'
          if (id.includes('node_modules/recharts')) return 'vendor-charts'
          if (id.includes('node_modules/@xterm')) return 'vendor-terminal'
          if (id.includes('node_modules/react-markdown')) return 'vendor-markdown'
          if (id.includes('node_modules/zustand') || id.includes('node_modules/date-fns') || id.includes('node_modules/clsx') || id.includes('node_modules/tailwind-merge')) return 'vendor-utils'
        },
      },
    },
  },
})
