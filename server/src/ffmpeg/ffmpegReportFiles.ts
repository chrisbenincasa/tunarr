import { FfmpegReportFilePrefix } from '@/util/constants.js';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { randomUUID } from 'node:crypto';

/**
 * Names of report files that a running ffmpeg is still writing.
 *
 * Log pruning skips these. At quiet log levels a healthy ffmpeg can go hours
 * without touching its report, so mtime alone can't tell a live file from an
 * abandoned one.
 */
export const activeFfmpegReportFiles = new Set<string>();

/**
 * Builds the report file name for one ffmpeg run.
 *
 * Tunarr names the file itself, rather than using FFREPORT's `%t`, so it knows
 * which file each running process owns. The random suffix keeps two processes
 * with the same name, started in the same second, from sharing a file.
 */
export function makeFfmpegReportFileName(
  ffmpegName: string,
  now: Dayjs = dayjs(),
): string {
  const normalizedName = ffmpegName.toLowerCase().replaceAll(' ', '-');
  const suffix = randomUUID().slice(0, 8);
  return `${FfmpegReportFilePrefix}${normalizedName}-${now.format('YYYYMMDD-HHmmss')}-${suffix}.log`;
}
