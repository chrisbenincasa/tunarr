import type { SettingsFile } from '@/db/SettingsDB.js';
import { getSettings } from '@/db/SettingsDB.js';
import type { GlobalOptions } from '@/globals.js';
import { globalOptions, setGlobalOptions } from '@/globals.js';
import tmp from 'tmp';
import type { DeepPartial } from 'ts-essentials';

function createTmpDir(tmpOpts?: tmp.DirOptions) {
  return new Promise<string>((resolve, reject) => {
    if (tmpOpts) {
      tmp.dir(tmpOpts, (err, name) => {
        err ? reject(err) : resolve(name);
      });
    } else {
      tmp.dir((err, name) => {
        err ? reject(err) : resolve(name);
      });
    }
  });
}

export async function setTestGlobalOptions(
  opts?: DeepPartial<Omit<GlobalOptions, 'databaseDirectory'>>,
) {
  const tmpName = await createTmpDir({ unsafeCleanup: true });
  setGlobalOptions({
    database: tmpName,
    force_migration: false,
    log_level: 'debug',
    verbose: 0,
    ...(opts ?? {}),
  });
  return globalOptions();
}

export function getFakeSettingsDb(
  initialSettings?: DeepPartial<SettingsFile>,
  // tmpOpts?: tmp.DirOptions,
) {
  // return new Promise<SettingsDB>((resolve, reject) => {
  //   const cb: tmp.DirCallback = (err, name) => {
  //     if (err !== null) {
  //       throw reject(err);
  //     }
  //     resolve(getSettings(name, initizalSettings));
  //   };

  // });

  return getSettings(undefined, initialSettings);
}
