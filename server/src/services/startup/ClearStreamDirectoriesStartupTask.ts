import { inject, injectable } from 'inversify';
import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ISettingsDB } from '../../db/interfaces/ISettingsDB.ts';
import { defaultHlsOptions } from '../../ffmpeg/builder/constants.ts';
import { serverOptions } from '../../globals.ts';
import { KEYS } from '../../types/inject.ts';
import { isNodeError, isNonEmptyString } from '../../util/index.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import { SimpleStartupTask } from './IStartupTask.ts';

const Uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

// stream_<channel>_<session instance>, or stream_<channel> from versions
// that shared one directory per channel. The transcode directory is
// user-configured, so anything else in it is left alone.
export const StreamDirectoryNameRegex = new RegExp(
  `^stream_${Uuid}(_${Uuid})?$`,
  'i',
);

/**
 * Removes HLS working directories left behind by an unclean exit.
 *
 * Each session instance writes to its own directory, so nothing reuses or
 * wipes a predecessor's. Startup tasks finish before the server listens, so no
 * live session can own one of these yet.
 */
@injectable()
export class ClearStreamDirectoriesStartupTask extends SimpleStartupTask {
  id = ClearStreamDirectoriesStartupTask.name;
  dependencies: string[] = [];

  @InjectLogger() declare private readonly logger: Logger;

  constructor(@inject(KEYS.SettingsDB) private settingsDB: ISettingsDB) {
    super();
  }

  async getPromise(): Promise<void> {
    const baseDirectories = new Set([
      path.join(
        serverOptions().databaseDirectory,
        defaultHlsOptions.segmentBaseDirectory,
      ),
    ]);
    const { transcodeDirectory } = this.settingsDB.ffmpegSettings();
    if (isNonEmptyString(transcodeDirectory)) {
      baseDirectories.add(transcodeDirectory);
    }

    for (const base of baseDirectories) {
      let entries: Dirent[];
      try {
        entries = await fs.readdir(base, { withFileTypes: true });
      } catch (e) {
        if (!isNodeError(e) || e.code !== 'ENOENT') {
          this.logger.warn(e, 'Could not read stream directory: %s', base);
        }
        continue;
      }

      for (const entry of entries) {
        if (
          !entry.isDirectory() ||
          !StreamDirectoryNameRegex.test(entry.name)
        ) {
          continue;
        }
        const dir = path.join(base, entry.name);
        this.logger.info('Removing leftover stream directory: %s', dir);
        await fs
          .rm(dir, { recursive: true, force: true, maxRetries: 2 })
          .catch((e: unknown) =>
            this.logger.warn(e, 'Could not remove stream directory: %s', dir),
          );
      }
    }
  }
}
