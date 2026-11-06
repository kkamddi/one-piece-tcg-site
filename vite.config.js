import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `src/data/articles/<slug>.json?meta` loads only that article's meta, so the bundled article list stays small
// while each article body is code-split and loaded on its own page.
const articleMeta = {
  name: 'card-pone-article-meta',
  enforce: 'pre',
  transform(code, id) {
    if (!/\/src\/data\/articles\/[^/]+\.json\?meta$/.test(id)) return null;
    return { code: JSON.stringify(JSON.parse(code).meta), map: null };
  }
};

export default defineConfig({
  plugins: [articleMeta, react(), tailwindcss()],
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
      '^/api/(portfolio|market|market-index)(\\?|$)': {
        target: 'https://www.optcgkorea.com',
        changeOrigin: true
      },
      '/__prod_api': {
        target: 'https://www.optcgkorea.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__prod_api/, '')
      }
    }
  }
});
