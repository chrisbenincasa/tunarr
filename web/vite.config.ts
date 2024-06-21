import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import path from 'node:path';
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    TanStackRouterVite({
      semicolons: true,
      routesDirectory: path.resolve(__dirname, './src/routes'),
    }),
  ],
  build: {
    sourcemap: true,
  },
  base: '/web',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: process.env['TUNARR_BIND_ADDR'] ?? 'localhost',
  },
});
