import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern',
      },
    },
  },
  server: {
    port: 8080,
    host: true
  },
  plugins: [react()],
});
