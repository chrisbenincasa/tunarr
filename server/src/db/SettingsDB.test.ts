import { Low, Memory } from 'lowdb';
import type { SettingsFile } from './SettingsDB.ts';
import {
  defaultSettings,
  SettingsDB,
  SettingsFileSchema,
} from './SettingsDB.ts';

type Data = {
  obj: {
    x: number;
    y: string;
  };
};

test('LowDB referential uppdates', async () => {
  const db = new Low<Data>(new Memory(), { obj: { x: 1, y: 'string' } });
  await db.read();
  const data = db.data;
  console.log(data);
  data.obj.x = 100;
  await db.write();
  console.log(db.data);
});

describe('pendingOperations', () => {
  const makeSettingsDb = () => {
    const initial = defaultSettings('/tmp/tunarr-test');
    return new SettingsDB(new Low<SettingsFile>(new Memory(), initial));
  };

  test('empty trash request round-trips back to null', async () => {
    const settingsDb = makeSettingsDb();

    expect(settingsDb.pendingOperations.emptyTrashRequestedAt).toBeNull();

    await settingsDb.markEmptyTrashRequested(1234);
    expect(settingsDb.pendingOperations.emptyTrashRequestedAt).toBe(1234);

    // lodash `merge` skips `undefined` but does assign `null`, which is what
    // makes clearing work through updateBaseSettings.
    await settingsDb.clearEmptyTrashRequested();
    expect(settingsDb.pendingOperations.emptyTrashRequestedAt).toBeNull();
  });

  test('a settings file predating pendingOperations parses with a default', () => {
    const withoutSection: Record<string, unknown> = {
      ...defaultSettings('/tmp/tunarr-test'),
    };
    delete withoutSection.pendingOperations;

    const parsed = SettingsFileSchema.parse(withoutSection);
    expect(parsed.pendingOperations).toEqual({ emptyTrashRequestedAt: null });
  });
});

describe('ffmpeg fileLogRetentionCount', () => {
  const settingsWithFfmpeg = (ffmpeg: Record<string, unknown>) => {
    const defaults = defaultSettings('/tmp/tunarr-test');
    return {
      ...defaults,
      settings: { ...defaults.settings, ffmpeg },
    };
  };

  test('a settings file predating the field parses with 50', () => {
    const ffmpeg: Record<string, unknown> = {
      ...defaultSettings('/tmp/tunarr-test').settings.ffmpeg,
    };
    delete ffmpeg.fileLogRetentionCount;

    const parsed = SettingsFileSchema.parse(settingsWithFfmpeg(ffmpeg));
    expect(parsed.settings.ffmpeg.fileLogRetentionCount).toBe(50);
  });

  test('rejects a value below 1', () => {
    const ffmpeg = {
      ...defaultSettings('/tmp/tunarr-test').settings.ffmpeg,
      fileLogRetentionCount: 0,
    };

    expect(
      SettingsFileSchema.safeParse(settingsWithFfmpeg(ffmpeg)).success,
    ).toBe(false);
  });
});
