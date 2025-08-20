import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  // input: 'http://localhost:8000/openapi.json',
  input: '../tunarr-openapi.json',
  output: 'src/generated',
  plugins: [
    {
      name: '@hey-api/client-axios',
      runtimeConfigPath: './src/client.ts',
    },
    {
      name: '@tanstack/react-query',
      queryKeys: {
        tags: true,
      },
    },
  ],
});
