import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/card-pone-app-[hash].js',
        chunkFileNames: 'assets/card-pone-chunk-[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const sourceName = assetInfo.names?.[0] || assetInfo.name || '';
          if (sourceName.endsWith('.css')) return 'assets/card-pone-styles-[hash][extname]';
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/__prod_api': {
        target: 'https://www.optcgkorea.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__prod_api/, '')
      }
    }
  }
});
