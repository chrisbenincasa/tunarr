import { describe, expect, test } from 'vitest';
import {
  hasScannedLibrary,
  isFfmpegOk,
  showFfmpegStep,
  syncedLibraries,
} from './welcomeChecklist.ts';

const library = (enabled: boolean, lastScannedAt?: number) => ({
  enabled,
  lastScannedAt,
});

describe('syncedLibraries', () => {
  test('keeps only enabled libraries on remote sources', () => {
    const enabled = library(true);
    expect(
      syncedLibraries([{ type: 'plex', libraries: [enabled, library(false)] }]),
    ).toEqual([enabled]);
  });

  test('keeps every library on local sources', () => {
    expect(
      syncedLibraries([{ type: 'local', libraries: [library(false)] }]),
    ).toHaveLength(1);
  });
});

describe('hasScannedLibrary', () => {
  test('is false with no sources', () => {
    expect(hasScannedLibrary(undefined)).toBe(false);
    expect(hasScannedLibrary([])).toBe(false);
  });

  test('ignores scans of disabled remote libraries', () => {
    expect(
      hasScannedLibrary([{ type: 'jellyfin', libraries: [library(false, 1)] }]),
    ).toBe(false);
  });

  test('is true once a synced library has been scanned', () => {
    expect(
      hasScannedLibrary([{ type: 'emby', libraries: [library(true, 1)] }]),
    ).toBe(true);
  });
});

describe('isFfmpegOk', () => {
  test.each([
    [undefined, true],
    [{ type: 'healthy' as const }, true],
    [{ type: 'info' as const, context: '' }, true],
    [{ type: 'warning' as const, context: '' }, true],
    [{ type: 'error' as const, context: '' }, false],
  ])('%o -> %s', (check, expected) => {
    expect(isFfmpegOk(check)).toBe(expected);
  });
});

describe('showFfmpegStep', () => {
  const failing = { type: 'error' as const, context: 'missing' };

  test('always shows outside a container', () => {
    expect(showFfmpegStep(false, { type: 'healthy' })).toBe(true);
    expect(showFfmpegStep(false, failing)).toBe(true);
  });

  test('hides in a container while FFmpeg is healthy', () => {
    expect(showFfmpegStep(true, { type: 'healthy' })).toBe(false);
    expect(showFfmpegStep(true, undefined)).toBe(false);
  });

  test('shows in a container when the check fails', () => {
    expect(showFfmpegStep(true, failing)).toBe(true);
  });

  test('shows in a container when the check warns', () => {
    expect(showFfmpegStep(true, { type: 'warning', context: 'unknown' })).toBe(
      true,
    );
  });
});
