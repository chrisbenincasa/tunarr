import { Mutex } from 'async-mutex';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileExists } from './fsUtil';
import { isUndefined } from 'lodash-es';

const checkerMutex = new Mutex();

let isDockerCached: boolean | undefined;

const hasDockerEnv = () => fileExists('/.dockerenv');
const hasDockerEnvSync = () => existsSync('/.dockerenv');
const hasDockerCGroup = async () => {
  const contents = await fs.readFile('/proc/self/cgroup', 'utf-8');
  return contents.includes('docker');
};
const hasDockerCGroupSync = () =>
  readFileSync('/proc/self/cgroup', 'utf-8').includes('docker');

export function isDockerAsync() {
  return checkerMutex.runExclusive(async () => {
    if (isUndefined(isDockerCached)) {
      isDockerCached = (await hasDockerEnv()) || (await hasDockerCGroup());
    }
    return isDockerCached;
  });
}

export function isDocker() {
  if (isUndefined(isDockerCached)) {
    isDockerCached = hasDockerEnvSync() || hasDockerCGroupSync();
  }
  return isDockerCached;
}
