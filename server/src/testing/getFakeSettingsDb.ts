import {
  defaultSettings,
  SettingsDB,
  type SettingsFile,
} from '@/db/SettingsDB.js';
import type { GlobalOptions } from '@/globals.js';
import { globalOptions, setGlobalOptions } from '@/globals.js';
import { merge } from 'lodash-es';
import { Low, Memory } from 'lowdb';
import tmp from 'tmp';
import type { DeepPartial } from 'ts-essentials';
import { SettingsDBFactory } from '../db/SettingsDBFactory.ts';

function createTmpDir(tmpOpts?: tmp.DirOptions) {
  return new Promise<string>((resolve, reject) => {
    if (tmpOpts) {
      tmp.dir(tmpOpts, (err, name) => {
        if (err) {
          reject(err);
        }
        resolve(name);
      });
    } else {
      tmp.dir((err, name) => {
        if (err) {
          reject(err);
        }
        resolve(name);
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
    log_level: 'debug',
    verbose: 0,
    ...(opts ?? {}),
  });
  return globalOptions();
}

export function getFakeSettingsDb(initialSettings?: DeepPartial<SettingsFile>) {
  return new SettingsDBFactory(globalOptions()).get(undefined, initialSettings);
}

export function inMemorySettingsDB(
  initialSettings?: DeepPartial<SettingsFile>,
) {
  const defaultValue = merge(
    {},
    defaultSettings(globalOptions().databaseDirectory),
    initialSettings,
  );
  return new SettingsDB(new Low(new Memory(), defaultValue));
}
