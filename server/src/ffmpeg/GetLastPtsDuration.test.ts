import { SettingsDB } from '@/db/SettingsDB.ts';
import {
  getFakeSettingsDb,
  setTestGlobalOptions,
} from '../testing/getFakeSettingsDb.js';
import { GetLastPtsDurationTask } from './GetLastPtsDuration.js';

let settingsDB: SettingsDB;
beforeAll(async () => {
  await setTestGlobalOptions();
  settingsDB = getFakeSettingsDb();
});

test.skip('Get last duration', async () => {
  const task = new GetLastPtsDurationTask();
  const result = await task.run(
    '/home/christian/Desktop/ffmpeg-test/test-out.ts',
  );
  console.log(result);
});
