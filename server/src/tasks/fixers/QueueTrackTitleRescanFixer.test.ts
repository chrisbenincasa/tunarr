import { bootstrapTunarr } from '@/bootstrap.js';
import { DBAccess } from '@/db/DBAccess.js';
import type { MediaSourceType } from '@/db/schema/base.js';
import type { DrizzleDBAccess } from '@/db/schema/index.js';
import { Program } from '@/db/schema/Program.js';
import { setGlobalOptionsUnchecked } from '@/globals.js';
import { canSkipUnchangedProgram } from '@/services/scanner/MediaSourceScanner.js';
import { inMemorySettingsDB } from '@/testing/getFakeSettingsDb.js';
import { copyPreMigratedDb } from '@/testing/testDbFactory.js';
import { eq } from 'drizzle-orm';
import tmp from 'tmp-promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  QueueTrackTitleRescanFixer,
  RescanCanonicalId,
} from './QueueTrackTitleRescanFixer.js';

describe('QueueTrackTitleRescanFixer', () => {
  let cleanup: () => Promise<void>;
  let drizzle: DrizzleDBAccess;

  beforeEach(async () => {
    const dbResult = await tmp.dir({ unsafeCleanup: true });
    await copyPreMigratedDb(dbResult.path);
    const opts = setGlobalOptionsUnchecked({
      database: dbResult.path,
      log_level: 'debug',
      verbose: 0,
    });
    await bootstrapTunarr(opts);
    const connection = DBAccess.instance.drizzle;
    if (!connection) {
      throw new Error('Expected Drizzle DB connection to be initialized');
    }
    drizzle = connection;
    cleanup = async () => {
      await DBAccess.instance.closeConnection(`${dbResult.path}/db.db`);
      await dbResult.cleanup();
    };
  });

  afterEach(async () => {
    await cleanup();
  });

  function insertProgram(
    uuid: string,
    sourceType: MediaSourceType,
    canonicalId: string | null,
  ) {
    drizzle
      .insert(Program)
      .values({
        uuid,
        canonicalId,
        duration: 60_000,
        externalKey: uuid,
        externalSourceId: `${sourceType}-source`,
        sourceType,
        title: uuid,
        type: 'movie',
      })
      .run();
  }

  function canonicalIdOf(uuid: string) {
    return drizzle
      .select({ canonicalId: Program.canonicalId })
      .from(Program)
      .where(eq(Program.uuid, uuid))
      .get()?.canonicalId;
  }

  function makeFixer(hasQueuedTrackTitleRescan: boolean) {
    const settingsDB = inMemorySettingsDB({
      migration: { hasQueuedTrackTitleRescan },
    });
    const fixer = new QueueTrackTitleRescanFixer(drizzle, settingsDB);
    return { fixer, settingsDB };
  }

  it('queues Plex and Emby programs and leaves other sources alone', async () => {
    insertProgram('plex', 'plex', 'plex-hash');
    insertProgram('emby', 'emby', 'emby-etag');
    insertProgram('jellyfin', 'jellyfin', 'jellyfin-etag');
    insertProgram('local', 'local', 'local-hash');
    insertProgram('plex-no-id', 'plex', null);

    const { fixer, settingsDB } = makeFixer(false);
    await fixer.run();

    expect(canonicalIdOf('plex')).toBe(RescanCanonicalId);
    expect(canonicalIdOf('emby')).toBe(RescanCanonicalId);
    expect(canonicalIdOf('jellyfin')).toBe('jellyfin-etag');
    expect(canonicalIdOf('local')).toBe('local-hash');
    expect(canonicalIdOf('plex-no-id')).toBeNull();
    expect(settingsDB.migrationState.hasQueuedTrackTitleRescan).toBe(true);
  });

  it('does nothing once the rescan has been queued', async () => {
    insertProgram('plex', 'plex', 'plex-hash');

    const { fixer } = makeFixer(true);
    await fixer.run();

    expect(canonicalIdOf('plex')).toBe('plex-hash');
  });

  it('makes the scanner rewrite a queued program', () => {
    const queued = { canonicalId: RescanCanonicalId, state: 'ok' as const };
    expect(canSkipUnchangedProgram(queued, 'plex-hash', false)).toBe(false);
  });
});
