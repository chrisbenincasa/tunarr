import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
  },
  base: '/web',
  server: {
    host: process.env['TUNARR_BIND_ADDR'] ?? 'localhost',
  },
});
