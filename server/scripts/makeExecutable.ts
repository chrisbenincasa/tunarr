import { compile } from 'nexe';

await compile({
  input: './build/bundle.js',
  output: './build/server-macos',
  targets: ['x64-20.11.1'],
  build: true,
  resources: ['./build/**/*', 'node_modules/**/*'],
  python: 'python3',
});
