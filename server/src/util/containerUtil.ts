import { Mutex } from 'async-mutex';
import { attempt, isError, isUndefined } from 'lodash-es';
import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import { fileExists } from './fsUtil.ts';

const checkerMutex = new Mutex();

let isDockerCached: boolean | undefined;

const hasDockerEnv = () => fileExists('/.dockerenv');
const hasDockerEnvSync = () => attempt(() => existsSync('/.dockerenv'));
const hasDockerCGroup = async () => {
  const contents = await fs.readFile('/proc/self/cgroup', 'utf-8');
  return contents.includes('docker');
};
const hasDockerCGroupSync = () =>
  attempt(() => readFileSync('/proc/self/cgroup', 'utf-8').includes('docker'));

export function isDockerAsync() {
  return checkerMutex.runExclusive(async () => {
    if (isUndefined(isDockerCached)) {
      isDockerCached =
        (await hasDockerEnv().catch(() => false)) ||
        (await hasDockerCGroup().catch(() => false));
    }
    return isDockerCached;
  });
}

export function isDocker() {
  if (isUndefined(isDockerCached)) {
    const hasEnv = hasDockerEnvSync();
    isDockerCached = !isError(hasEnv) && hasEnv;
    if (!isDockerCached) {
      const hasCgroup = hasDockerCGroupSync();
      isDockerCached = !isError(hasCgroup) && hasCgroup;
    }
  }
  return isDockerCached;
}

export function isPodman() {
  return process.env['CONTAINER'] === 'podman';
}

export function isRunningInContainer() {
  return isDocker() || isPodman();
}
