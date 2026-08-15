import type { StreamLineupProgram } from '@/db/derived_types/StreamLineup.js';
import { globalOptions } from '@/globals.js';
import { VideoStream } from '@/ffmpeg/builder/MediaStream.js';
import { ColorFormat } from '@/ffmpeg/builder/format/ColorFormat.js';
import { PixelFormatUnknown } from '@/ffmpeg/builder/format/PixelFormat.js';
import { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.js';
import { LavfiInputOption } from '@/ffmpeg/builder/options/input/LavfiInputOption.js';
import { FrameSize } from '@/ffmpeg/builder/types.js';
import { FilterStreamSource } from '@/stream/types.js';
import { isNonEmptyString } from '@/util/index.js';
import type { Watermark } from '@tunarr/types';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const ProgramTitleOverlaySize = FrameSize.create({ width: 1600, height: 96 });
const ProgramTitleOverlayCacheFolder = 'program-title-overlays';

function episodeNumberLabel(
  seasonNumber: number | null | undefined,
  episodeNumber: number | null | undefined,
): string | undefined {
  const season =
    typeof seasonNumber === 'number' && Number.isInteger(seasonNumber)
      ? `S${seasonNumber.toString().padStart(2, '0')}`
      : '';
  const episode =
    typeof episodeNumber === 'number' && Number.isInteger(episodeNumber)
      ? `E${episodeNumber.toString().padStart(2, '0')}`
      : '';
  const label = `${season}${episode}`;
  return label.length > 0 ? label : undefined;
}

function joinTitleParts(
  parts: (string | null | undefined)[],
): string | undefined {
  const result: string[] = [];
  for (const part of parts) {
    if (isNonEmptyString(part) && result.at(-1) !== part) {
      result.push(part);
    }
  }
  return result.length > 0 ? result.join(' · ') : undefined;
}

export function formatProgramTitle(
  program: StreamLineupProgram,
): string | undefined {
  switch (program.type) {
    case 'episode':
      return joinTitleParts([
        program.show?.title ?? program.showTitle,
        episodeNumberLabel(
          program.season?.index ?? program.seasonNumber,
          program.episode,
        ),
        program.title,
      ]);
    case 'track':
      return joinTitleParts([
        program.artist?.title ?? program.artistName,
        program.album?.title ?? program.albumName,
        program.title,
      ]);
    default:
      return isNonEmptyString(program.title) ? program.title : undefined;
  }
}

export function escapeDrawtextFilePath(filePath: string): string {
  return filePath
    .replaceAll('\\', '/')
    .replaceAll("'", "\\'")
    .replaceAll(':', '\\:')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]');
}

export function programTitleLavfiSource(textFilePath: string): string {
  const escapedPath = escapeDrawtextFilePath(textFilePath);
  return [
    `color=c=black@0.0:s=${ProgramTitleOverlaySize.width}x${ProgramTitleOverlaySize.height}`,
    'format=rgba',
    `drawtext=textfile='${escapedPath}':expansion=none:fontsize=48:fontcolor=white:borderw=3:bordercolor=black:x=8:y=(h-text_h)/2`,
  ].join(',');
}

async function cacheProgramTitleText(
  title: string,
  databaseDirectory: string,
): Promise<string> {
  const cacheDirectory = path.join(
    databaseDirectory,
    'cache',
    ProgramTitleOverlayCacheFolder,
  );
  const cacheKey = createHash('sha256').update(title).digest('hex');
  const titleFilePath = path.join(cacheDirectory, `${cacheKey}.txt`);

  await fs.mkdir(cacheDirectory, { recursive: true });
  await fs.writeFile(titleFilePath, title, 'utf8');
  return titleFilePath;
}

export async function createProgramTitleOverlayInput(
  program: StreamLineupProgram,
  watermark: Watermark,
  databaseDirectory = globalOptions().databaseDirectory,
): Promise<WatermarkInputSource | undefined> {
  const title = formatProgramTitle(program);
  if (!title) {
    return;
  }

  const titleFilePath = await cacheProgramTitleText(title, databaseDirectory);
  const stream = VideoStream.create({
    codec: 'generated',
    colorFormat: ColorFormat.unknown,
    displayAspectRatio: '50:3',
    frameSize: ProgramTitleOverlaySize,
    index: 0,
    inputKind: 'filter',
    pixelFormat: PixelFormatUnknown(),
    providedSampleAspectRatio: '1:1',
  });
  const input = new WatermarkInputSource(
    new FilterStreamSource(programTitleLavfiSource(titleFilePath)),
    stream,
    { ...watermark, animated: false },
  );
  input.addOption(new LavfiInputOption());
  return input;
}
