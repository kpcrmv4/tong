import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss()
    ],
    resolve: {
      alias: {
        '@': __dirname,
      },
    },
    server: {
      hmr: true,
      watch: {
        usePolling: true,
        interval: 300,
      },
    },
  };
});
