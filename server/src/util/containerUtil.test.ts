import { fs, vol } from 'memfs';
import { afterEach, describe, test, vi } from 'vitest';
import { isRunningInContainer } from './containerUtil.ts';

// Mock fs everywhere else with the memfs version.
vi.mock('fs', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');

  // Support both `import fs from "fs"` and "import { readFileSync } from "fs"`
  return { default: memfs.fs, ...memfs.fs };
});

vi.mock('fs/promises', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');

  // Support both `import fs from "fs"` and "import { readFileSync } from "fs"`
  return { default: memfs.fs, ...memfs.fs.promises };
});

const containerdContents = `
cat /proc/self/cgroup
0::/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-podbeba82a5_39ae_4d4a_96d1_3ac0f5daea0b.slice/cri-containerd-ac9e940a85fa71b41994caa6dcec3f9aaa586928942e4297441afbb5671c7bec.scope
`;

describe('containerUtil', () => {
  afterEach(() => {
    vol.reset();
    vi.unstubAllEnvs();
  });

  test('isRunningInContainer - docker in cgroup file', () => {
    fs.mkdirSync('/proc/self', { recursive: true });
    fs.writeFileSync('/proc/self/cgroup', 'docker');
    expect(isRunningInContainer()).toBeTruthy();
  });

  test('isRunningInContainer - .dockerenv file', () => {
    fs.writeFileSync('/.dockerenv', '');
    expect(isRunningInContainer()).toBeTruthy();
  });

  test('isRunningInContainer - podman', () => {
    vi.stubEnv('CONTAINER', 'podman');
    expect(isRunningInContainer()).toBeTruthy();
  });

  test('isRunningInContainer - conatinerd general', () => {
    fs.mkdirSync('/proc/self', { recursive: true });
    fs.writeFileSync('/proc/self/cgroup', containerdContents);
    expect(isRunningInContainer()).toBeTruthy();
  });
});
