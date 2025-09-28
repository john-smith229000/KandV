import {defineConfig} from 'vite';

export default defineConfig({
  envDir: '../',  // This looks for .env in the root directory
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
    hmr: {
      clientPort: 443,
    },
  },
});