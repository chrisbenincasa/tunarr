import type { ContentBackedStreamLineupItem } from '@/db/derived_types/StreamLineup.js';
import type { FfprobeMediaInfo } from '@/types/ffmpeg.js';
import { isNonEmptyString } from '@/util/index.js';
import path from 'node:path';

export type NowPlayingOverlayPayload = {
  title: string;
  subtitle?: string;
  nextTitle?: string;
  nextSubtitle?: string;
  windows: NowPlayingOverlayWindow[];
  comingUpNextWindows: NowPlayingOverlayWindow[];
  fadeDurationSeconds: number;
  fontFile?: string;
};

export type NowPlayingOverlayWindow = {
  startSeconds: number;
  endSeconds: number;
};

export type NowPlayingMetadata = {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  filePath?: string;
};

export function getNowPlayingMetadata(
  lineupItem: ContentBackedStreamLineupItem,
): NowPlayingMetadata {
  const { program } = lineupItem;
  return {
    title: normalizeText(program.title),
    artist: normalizeText(program.artistName),
    album: normalizeText(program.albumName),
    year: extractYear(program.year ?? program.originalAirDate),
  };
}

export function getNowPlayingMetadataFromFfprobe(
  probe: FfprobeMediaInfo,
): NowPlayingMetadata {
  return {
    title: findAnyTag(probe, ['title']),
    artist: findAnyTag(probe, ['artist', 'album_artist', 'composer']),
    album: findAnyTag(probe, ['album']),
    year: extractYear(
      findAnyTag(probe, ['year', 'date', 'creation_time', 'releasedate']),
    ),
  };
}

export function resolveNowPlayingOverlay(args: {
  metadata: NowPlayingMetadata;
  nextMetadata?: NowPlayingMetadata;
  filePath?: string;
  fontFile?: string;
  showForSeconds: number;
  showAtEndForSeconds?: number;
  startPaddingSeconds?: number;
  endPaddingSeconds?: number;
  comingUpNextForSeconds?: number;
  comingUpNextOffsetSeconds?: number;
  fadeDurationSeconds?: number;
  startOffsetSeconds: number;
  remainingDurationSeconds: number;
}): NowPlayingOverlayPayload | undefined {
  const fadeDuration = args.fadeDurationSeconds ?? 0.5;
  const startPadding = args.startPaddingSeconds ?? 0;
  const endPadding = args.endPaddingSeconds ?? 0;
  const comingUpNextFor = args.comingUpNextForSeconds ?? 0;
  const comingUpNextOffset = args.comingUpNextOffsetSeconds ?? 30;

  const windows = buildOverlayWindows({
    showForSeconds: args.showForSeconds,
    showAtEndForSeconds: args.showAtEndForSeconds ?? 0,
    startPaddingSeconds: startPadding,
    endPaddingSeconds: endPadding,
    startOffsetSeconds: args.startOffsetSeconds,
    remainingDurationSeconds: args.remainingDurationSeconds,
  });

  const closingWindow = windows.length >= 2 ? windows[1] : undefined;
  const comingUpNextWindows = buildComingUpNextWindow({
    comingUpNextForSeconds: comingUpNextFor,
    comingUpNextOffsetSeconds: comingUpNextOffset,
    startOffsetSeconds: args.startOffsetSeconds,
    remainingDurationSeconds: args.remainingDurationSeconds,
    openingWindow: windows[0],
    closingWindow,
  });

  if (windows.length === 0 && comingUpNextWindows.length === 0) {
    return;
  }

  const title =
    normalizeText(args.metadata.title) ??
    filenameToNowPlayingTitle(args.filePath);
  if (!title) {
    return;
  }

  const subtitle = joinNonEmpty([
    args.metadata.artist,
    args.metadata.album,
    args.metadata.year,
  ]);

  const nextTitle = normalizeText(args.nextMetadata?.title);
  const resolvedNextTitle =
    nextTitle ?? filenameToNowPlayingTitle(args.nextMetadata?.filePath);
  const nextSubtitle = joinNonEmpty([
    args.nextMetadata?.artist,
    args.nextMetadata?.album,
    args.nextMetadata?.year,
  ]);

  return {
    title,
    subtitle,
    nextTitle: comingUpNextWindows.length > 0 ? resolvedNextTitle : undefined,
    nextSubtitle: comingUpNextWindows.length > 0 ? nextSubtitle : undefined,
    windows,
    comingUpNextWindows: resolvedNextTitle ? comingUpNextWindows : [],
    fadeDurationSeconds: fadeDuration,
    fontFile: args.fontFile,
  };
}

export function filenameToNowPlayingTitle(
  filePath?: string,
): string | undefined {
  if (!isNonEmptyString(filePath)) {
    return;
  }

  const parsed = path.parse(filePath);
  const cleaned = normalizeText(parsed.name.replaceAll(/[._]+/g, ' '));
  return cleaned;
}

function findAnyTag(
  probe: FfprobeMediaInfo,
  keys: readonly string[],
): string | undefined {
  const tagSets = [
    probe.format.tags,
    ...probe.streams.map((stream) =>
      'tags' in stream ? stream.tags : undefined,
    ),
  ];

  for (const tags of tagSets) {
    if (!tags) {
      continue;
    }

    const normalized = new Map<string, string>(
      Object.entries(tags).map(([key, value]) => [key.toLowerCase(), value]),
    );

    for (const key of keys) {
      const value = normalizeText(normalized.get(key.toLowerCase()));
      if (value) {
        return value;
      }
    }
  }

  return;
}

function extractYear(
  input: number | string | null | undefined,
): string | undefined {
  if (typeof input === 'number' && Number.isFinite(input) && input > 0) {
    return Math.trunc(input).toString();
  }

  if (!isNonEmptyString(input)) {
    return;
  }

  const match = input.match(/\b(19|20)\d{2}\b/);
  return match?.[0];
}

function joinNonEmpty(values: Array<string | undefined>): string | undefined {
  const filtered = values.flatMap((value) => (value ? [value] : []));
  return filtered.length > 0 ? filtered.join(' - ') : undefined;
}

function normalizeText(value: string | null | undefined): string | undefined {
  if (!isNonEmptyString(value)) {
    return;
  }

  const trimmed = value.replaceAll(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function roundSeconds(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function buildOverlayWindows(args: {
  showForSeconds: number;
  showAtEndForSeconds: number;
  startPaddingSeconds: number;
  endPaddingSeconds: number;
  startOffsetSeconds: number;
  remainingDurationSeconds: number;
}): NowPlayingOverlayWindow[] {
  const windows: NowPlayingOverlayWindow[] = [];
  const remaining = roundSeconds(Math.max(0, args.remainingDurationSeconds));

  // Opening window: starts after startPadding, adjusted by startOffset
  const openingStart = roundSeconds(
    Math.max(0, args.startPaddingSeconds - args.startOffsetSeconds),
  );
  const openingEnd = roundSeconds(
    Math.min(
      remaining,
      Math.max(
        0,
        args.showForSeconds + args.startPaddingSeconds - args.startOffsetSeconds,
      ),
    ),
  );
  if (openingEnd > openingStart) {
    windows.push({
      startSeconds: openingStart,
      endSeconds: openingEnd,
    });
  }

  // Closing window: ends at remaining - endPadding
  const closingDuration = roundSeconds(Math.max(0, args.showAtEndForSeconds));
  const closingEnd = roundSeconds(
    Math.max(0, remaining - args.endPaddingSeconds),
  );
  const closingStart = roundSeconds(
    Math.max(0, closingEnd - closingDuration),
  );
  if (remaining > 0 && closingDuration > 0 && closingEnd > closingStart) {
    // Skip if it would overlap with the opening window
    const lastOpening = windows[windows.length - 1];
    if (!lastOpening || closingStart >= lastOpening.endSeconds) {
      windows.push({
        startSeconds: closingStart,
        endSeconds: closingEnd,
      });
    }
  }

  return windows;
}

function buildComingUpNextWindow(args: {
  comingUpNextForSeconds: number;
  comingUpNextOffsetSeconds: number;
  startOffsetSeconds: number;
  remainingDurationSeconds: number;
  openingWindow?: NowPlayingOverlayWindow;
  closingWindow?: NowPlayingOverlayWindow;
}): NowPlayingOverlayWindow[] {
  if (args.comingUpNextForSeconds <= 0) {
    return [];
  }

  const remaining = roundSeconds(Math.max(0, args.remainingDurationSeconds));
  if (remaining <= 0) {
    return [];
  }

  const cuStart = roundSeconds(
    Math.max(0, remaining - args.comingUpNextOffsetSeconds),
  );
  const cuEnd = roundSeconds(
    Math.min(remaining, cuStart + args.comingUpNextForSeconds),
  );

  if (cuEnd <= cuStart) {
    return [];
  }

  // Skip if it overlaps with the opening window
  if (args.openingWindow && cuStart < args.openingWindow.endSeconds) {
    return [];
  }

  // Skip if it overlaps with the closing window
  if (args.closingWindow && cuEnd > args.closingWindow.startSeconds) {
    return [];
  }

  return [{ startSeconds: cuStart, endSeconds: cuEnd }];
}
