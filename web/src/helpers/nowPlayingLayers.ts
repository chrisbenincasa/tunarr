import type { TvGuideProgram } from '@tunarr/types';

/** Wait after a program's stop before asking the server what's on. */
export const RefreshAfterStopMs = 1_000;

/** Retry delay when the server still reports a program that already ended. */
export const StaleRetryMs = 5_000;

/** Longest single wait, well under the browser's 2^31 - 1 ms timer limit. */
export const MaxRefreshDelayMs = 60 * 60 * 1_000;

/** How long to wait before refetching the program airing now. */
export function nowPlayingRefreshDelayMs(stop: number, now: number): number {
  if (stop <= now) {
    return StaleRetryMs;
  }
  return Math.min(stop - now + RefreshAfterStopMs, MaxRefreshDelayMs);
}

/**
 * One airing shown in the now-playing card. A layer is ready once its image
 * has loaded, or failed with no fallback left.
 */
export type NowPlayingLayer = {
  program: TvGuideProgram;
  ready: boolean;
};

function sameAiring(a: TvGuideProgram, b: TvGuideProgram) {
  return a.start === b.start && a.stop === b.stop;
}

/**
 * Adds the program as the newest layer when it is a new airing. Returns the
 * same array when nothing changed.
 */
export function pushProgram(
  layers: NowPlayingLayer[],
  program: TvGuideProgram,
): NowPlayingLayer[] {
  const newest = layers.at(-1);
  if (newest && sameAiring(newest.program, program)) {
    return layers;
  }
  return [...layers, { program, ready: false }];
}

export function markReady(
  layers: NowPlayingLayer[],
  program: TvGuideProgram,
): NowPlayingLayer[] {
  return layers.map((layer) =>
    !layer.ready && sameAiring(layer.program, program)
      ? { ...layer, ready: true }
      : layer,
  );
}

/**
 * The layer on screen. That is the newest ready layer, or the newest layer
 * when none is ready yet, which shows a skeleton while its image loads.
 */
export function visibleLayerIndex(layers: NowPlayingLayer[]): number {
  for (let i = layers.length - 1; i >= 0; i--) {
    if (layers[i]?.ready) {
      return i;
    }
  }
  return layers.length - 1;
}

/** Drops the layers older than the one on screen. */
export function pruneHiddenLayers(
  layers: NowPlayingLayer[],
): NowPlayingLayer[] {
  const visible = visibleLayerIndex(layers);
  return visible <= 0 ? layers : layers.slice(visible);
}
