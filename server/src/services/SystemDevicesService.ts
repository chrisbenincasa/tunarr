import { Mutex } from 'async-mutex';
import { inject, injectable } from 'inversify';
import { first, isEmpty, negate, trim } from 'lodash-es';
import NodeCache from 'node-cache';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { KEYS } from '../types/inject.ts';
import { Result } from '../types/result.ts';
import { Maybe } from '../types/util.ts';
import { cacheGetOrSet } from '../util/cache.ts';
import { ChildProcessHelper } from '../util/ChildProcessHelper.ts';
import { isDocker } from '../util/containerUtil.ts';
import { fileExists } from '../util/fsUtil.ts';
import { isLinux, isMac, isNonEmptyString, isWindows } from '../util/index.ts';
import type { Logger } from '../util/logging/LoggerFactory.ts';

@injectable()
export class SystemDevicesService {
  private static LOCK = new Mutex();
  private static DEVICES_KEY = 'direct_render_devices';
  private static DISPLAYS_KEY = 'vaapi_displays';
  private static CACHE = new NodeCache({
    stdTTL: 0,
  });

  constructor(@inject(KEYS.Logger) private logger: Logger) {}

  getDevices(): Maybe<string[]> {
    return SystemDevicesService.CACHE.get(SystemDevicesService.DEVICES_KEY);
  }

  getDisplays(): Maybe<string[]> {
    return SystemDevicesService.CACHE.get(SystemDevicesService.DISPLAYS_KEY);
  }

  async seed() {
    return SystemDevicesService.LOCK.runExclusive(async () => {
      if (!isLinux()) {
        return;
      }

      await Promise.all([this.discoverDevices(), this.discoverDisplays()]);

      return;
    });
  }

  private discoverDevices() {
    try {
      return cacheGetOrSet(
        SystemDevicesService.CACHE,
        SystemDevicesService.DEVICES_KEY,
        async () => {
          const devices: string[] = [];
          if (isWindows() || isMac()) {
            return [];
          }

          if (!(await fileExists('/dev/dri'))) {
            if (isDocker()) {
              this.logger.warn(
                'Could not find /dev/dri directory. Did you pass this in as a device when starting your container?',
              );
            } else {
              this.logger.error(
                'Unexpected state. Found no /dev/dri on Linux machine.',
              );
            }

            return [];
          }

          for (const device of await readdir('/dev/dri')) {
            if (device.startsWith('card') || device.startsWith('render')) {
              devices.push(path.join('/dev/dri', device));
            }
          }
          return devices;
        },
      );
    } catch (e) {
      this.logger.error(e, 'Error while reading devices');
    }

    return;
  }

  private async discoverDisplays() {
    return cacheGetOrSet(
      SystemDevicesService.CACHE,
      SystemDevicesService.DISPLAYS_KEY,
      async () => {
        try {
          const processHelper = new ChildProcessHelper();
          const vaInfoStdoutResult = await Result.attemptAsync(() =>
            processHelper.getStdout('which', ['vainfo'], {
              isPath: false,
            }),
          );
          if (vaInfoStdoutResult.isFailure()) {
            this.logger.warn(
              'Unable to locate vainfo on system. May not be able to auto-detect hardware acceleration capabilities',
            );
            return;
          }
          const vaInfoPath = first(
            vaInfoStdoutResult.get().split('\n').map(trim),
          );

          if (!isNonEmptyString(vaInfoPath)) {
            return ['drm'];
          }

          const output = await processHelper.getStdout(vaInfoPath, [
            '--display',
            'help',
          ]);
          return output.split('\n').map(trim).filter(negate(isEmpty)).slice(1);
        } catch (e) {
          this.logger.error(e);
          return ['drm'];
        }
      },
    );
  }
}
