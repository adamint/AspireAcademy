import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.PORT || '5173'),
    proxy: {
      '/api': {
        target: process.env.services__api__http__0 || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@chakra-ui') || id.includes('node_modules/@emotion')) {
            return 'vendor-chakra';
          }
          if (id.includes('node_modules/monaco') || id.includes('node_modules/@monaco-editor')) {
            return 'vendor-monaco';
          }
          if (id.includes('node_modules/react-markdown') || id.includes('node_modules/react-syntax-highlighter')) {
            return 'vendor-markdown';
          }
        },
      },
    },
  },
})
