import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies /api to Express so the browser only ever talks to one
// origin. That keeps cookies/CORS simple in development and mirrors how the
// production build will be served behind a single domain.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:5001',
        changeOrigin: true
      }
    }
  }
});
