import { compile } from 'nexe';

await compile({
  input: './build/bundle.js',
  name: './build/tunarr-macos-x64',
  targets: ['mac-x64-20.11.1'],
  build: true,
  resources: ['./build/**/*'],
  python: 'python3',
});

await compile({
  input: './build/bundle.js',
  name: './build/tunarr-linux-x64',
  targets: ['linux-x64-20.11.1'],
  // build: true,
  resources: ['./build/**/*'],
  python: 'python3',
});
