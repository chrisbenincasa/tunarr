import tmp from 'tmp';
import { DeepPartial } from 'ts-essentials';
import { SettingsFile, getSettings } from '../dao/settings.js';
import { GlobalOptions, globalOptions, setGlobalOptions } from '../globals.js';

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
    databaseDirectory: tmpName,
    force_migration: false,
    log_level: 'debug',
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
