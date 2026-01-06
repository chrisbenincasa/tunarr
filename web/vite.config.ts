import dotenv from '@dotenvx/dotenvx';
dotenv.config({ debug: false });

import { tanstackRouter } from '@tanstack/router-vite-plugin';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';
import packageDef from './package.json' with { type: 'json' };

export const BUILD_ENV_VAR = 'TUNARR_BUILD';
export const IS_EDGE_BUILD_ENV_VAR = 'TUNARR_EDGE_BUILD';
const packageVersion = packageDef.version;

const version = (() => {
  let tunarrVersion = process.env.TUNARR_VERSION ?? packageVersion;
  const build = process.env[BUILD_ENV_VAR] ?? '';
  const isEdgeBuildValue = process.env[IS_EDGE_BUILD_ENV_VAR];
  const isEdgeBuild = isEdgeBuildValue === 'true' || isEdgeBuildValue === '1';
  const isDev = process.env['NODE_ENV'] !== 'production';
  if (build.length > 0 && isEdgeBuild) {
    tunarrVersion += `-${build}`;
  }
  if (isDev) {
    tunarrVersion += '-dev';
  }
  return tunarrVersion;
})();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tanstackRouter({
      semicolons: true,
      routesDirectory: path.resolve(__dirname, './src/routes'),
    }),
    svgr(),
  ],
  build: {
    sourcemap: true,
  },
  define: {
    __TUNARR_VERSION__: `"${version}"`,
  },
  esbuild: {
    minifySyntax: true,
    minifyWhitespace: true,
    minifyIdentifiers: false,
    keepNames: true,
  },
  base: '/web',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true, // process.env['TUNARR_BIND_ADDR'] ?? 'localhost',
  },
});
