import { Mutex } from 'async-mutex';
import { attempt, isError, isUndefined } from 'lodash-es';
import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import type { Maybe } from '../types/util.ts';
import { fileExists } from './fsUtil.ts';

const checkerMutex = new Mutex();
const cGroupReadMutex = new Mutex();

let isDockerCached: boolean | undefined;
let cachedCgroupContents: Maybe<string>;

const readCgroupAsync = async () => {
  return cGroupReadMutex.runExclusive(async () => {
    if (cachedCgroupContents) {
      return cachedCgroupContents;
    }
    cachedCgroupContents = await fs.readFile('/proc/self/cgroup', 'utf-8');
    return cachedCgroupContents;
  });
};

const readCgroupSync = () => {
  if (cachedCgroupContents) {
    return cachedCgroupContents;
  }
  cachedCgroupContents = readFileSync('/proc/self/cgroup', 'utf-8');
  return cachedCgroupContents;
};

const hasDockerEnv = () => fileExists('/.dockerenv');
const hasDockerEnvSync = () => attempt(() => existsSync('/.dockerenv'));
const hasDockerCGroup = async () => {
  return (await readCgroupAsync()).includes('docker');
};
const hasDockerCGroupSync = () => {
  try {
    return readCgroupSync().includes('docker');
  } catch {
    return false;
  }
};

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

export function isOtherwiseContainerized() {
  try {
    return readCgroupSync().toLowerCase().includes('containerd');
  } catch {
    return false;
  }
}

export function isRunningInContainer() {
  return isDocker() || isPodman() || isOtherwiseContainerized();
}
