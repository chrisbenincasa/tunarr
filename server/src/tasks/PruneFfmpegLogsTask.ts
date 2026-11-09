import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import { activeFfmpegReportFiles } from '@/ffmpeg/ffmpegReportFiles.js';
import { KEYS } from '@/types/inject.js';
import {
  FfmpegErrorLogFilePrefix,
  FfmpegReportFilePrefix,
} from '@/util/constants.js';
import { InjectLogger } from '@/util/inject.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { inject, injectable } from 'inversify';
import { isError } from 'lodash-es';
import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { TaskId } from './Task.ts';
import { SimpleTask } from './Task.ts';
import { simpleTaskDef } from './TaskRegistry.ts';

/**
 * Files younger than this are never pruned.
 *
 * A safety margin on top of `activeFfmpegReportFiles`, which names the reports
 * of running processes.
 */
export const FfmpegLogMinAgeMs = 10 * 60 * 1000;

export type PruneFfmpegLogsResult = {
  deleted: string[];
  failed: { name: string; error: unknown }[];
};

export function isFfmpegLogFile(name: string): boolean {
  return (
    name.endsWith('.log') &&
    (name.startsWith(FfmpegReportFilePrefix) ||
      name.startsWith(FfmpegErrorLogFilePrefix))
  );
}

export type PruneFfmpegLogsOptions = {
  now?: Date;
  /** File names to keep regardless of age, such as reports still being written. */
  skip?: ReadonlySet<string>;
};

/**
 * Deletes all but the newest `keep` ffmpeg report and error log files in
 * `directory`, ordered by mtime. Files named in `skip`, or modified within
 * `FfmpegLogMinAgeMs` of `now`, are kept even when they fall past the cap.
 */
export async function pruneFfmpegLogs(
  directory: string,
  keep: number,
  { now = new Date(), skip = new Set() }: PruneFfmpegLogsOptions = {},
): Promise<PruneFfmpegLogsResult> {
  const result: PruneFfmpegLogsResult = { deleted: [], failed: [] };

  let entries: Dirent[];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (e) {
    if (isError(e) && 'code' in e && e.code === 'ENOENT') {
      return result;
    }
    throw e;
  }

  const stats = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && isFfmpegLogFile(entry.name))
      .map(async (entry) => {
        try {
          const stat = await fs.stat(path.join(directory, entry.name));
          return { name: entry.name, mtimeMs: stat.mtimeMs };
        } catch {
          // Deleted between readdir and stat.
          return null;
        }
      }),
  );

  const candidates = stats
    .filter((file) => file !== null)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(keep)
    .filter(
      (file) =>
        !skip.has(file.name) &&
        now.getTime() - file.mtimeMs >= FfmpegLogMinAgeMs,
    );

  await Promise.all(
    candidates.map(async ({ name }) => {
      try {
        await fs.rm(path.join(directory, name), { force: true });
        result.deleted.push(name);
      } catch (error) {
        result.failed.push({ name, error });
      }
    }),
  );

  return result;
}

@injectable()
@simpleTaskDef({
  description:
    'Deletes old ffmpeg report and error log files from the logs directory',
})
export class PruneFfmpegLogsTask extends SimpleTask {
  @InjectLogger() declare protected readonly logger: Logger;

  public static ID: TaskId = PruneFfmpegLogsTask.name;
  public ID = PruneFfmpegLogsTask.ID;

  constructor(@inject(KEYS.SettingsDB) private settingsDB: ISettingsDB) {
    super();
  }

  protected async runInternal(): Promise<void> {
    const directory = this.settingsDB.systemSettings().logging.logsDirectory;
    const keep = this.settingsDB.ffmpegSettings().fileLogRetentionCount;

    const { deleted, failed } = await pruneFfmpegLogs(directory, keep, {
      skip: activeFfmpegReportFiles,
    });

    if (deleted.length > 0) {
      this.logger.debug(
        'Deleted %d old ffmpeg log file(s) from %s',
        deleted.length,
        directory,
      );
    }

    for (const { name, error } of failed) {
      this.logger.warn(error, 'Could not delete ffmpeg log file %s', name);
    }
  }
}
