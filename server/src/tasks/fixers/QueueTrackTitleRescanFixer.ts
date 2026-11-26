import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import Fixer from '@/tasks/fixers/fixer.js';
import { KEYS } from '@/types/inject.js';
import { InjectLogger } from '@/util/inject.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { and, inArray, isNotNull } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import type { MediaSourceType } from '../../db/schema/base.ts';
import type { DrizzleDBAccess } from '../../db/schema/index.ts';
import { Program } from '../../db/schema/Program.ts';

/**
 * A canonical ID that no media server item hashes to. The scanner skips a
 * program whose stored canonical ID matches the incoming one, so this forces
 * the next scan to rewrite the program.
 *
 * A null canonical ID would also defeat the skip, but the scanner's
 * existing-program lookups ignore null rows and would then mark those
 * programs missing.
 */
export const RescanCanonicalId = 'tunarr:rescan';

const AffectedSourceTypes: MediaSourceType[] = ['plex', 'emby'];

/**
 * Plex programs used to store Plex's generated stream label ("English (AAC
 * Stereo)") as the track title, and Emby programs stored no title. Scans now
 * store the file's own track title, but unchanged items skip the rewrite.
 * This queues every Plex and Emby program for a rewrite on its next scan.
 * Runs once; completion is recorded in the settings file.
 */
@injectable()
export class QueueTrackTitleRescanFixer extends Fixer {
  @InjectLogger() declare protected readonly logger: Logger;

  canRunInBackground = true;

  constructor(
    @inject(KEYS.DrizzleDB) private drizzle: DrizzleDBAccess,
    @inject(KEYS.SettingsDB) private settingsDB: ISettingsDB,
  ) {
    super();
  }

  protected async runInternal(): Promise<void> {
    if (this.settingsDB.migrationState.hasQueuedTrackTitleRescan) {
      return;
    }

    const result = await this.drizzle
      .update(Program)
      .set({ canonicalId: RescanCanonicalId })
      .where(
        and(
          inArray(Program.sourceType, AffectedSourceTypes),
          isNotNull(Program.canonicalId),
        ),
      );

    this.logger.info(
      'Queued %d Plex and Emby programs for a rescan to update their track titles',
      result.changes,
    );

    await this.settingsDB.updateBaseSettings('migration', {
      hasQueuedTrackTitleRescan: true,
    });
  }
}
