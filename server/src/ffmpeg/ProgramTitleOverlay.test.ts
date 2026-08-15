import type { StreamLineupProgram } from '@/db/derived_types/StreamLineup.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createProgramTitleOverlayInput,
  escapeDrawtextFilePath,
  formatProgramTitle,
  programTitleLavfiSource,
} from './ProgramTitleOverlay.ts';

const temporaryDirectories: string[] = [];

function makeProgram(
  overrides: Partial<StreamLineupProgram> = {},
): StreamLineupProgram {
  return {
    duration: 30_000,
    externalIds: [],
    externalKey: 'external-key',
    externalSourceId: 'external-source-id',
    mediaSourceId: 'media-source-id',
    sourceType: 'jellyfin',
    title: 'Episode title',
    type: 'episode',
    uuid: 'program-id',
    ...overrides,
  } as StreamLineupProgram;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { force: true, recursive: true })),
  );
});

describe('formatProgramTitle', () => {
  it('formats an episode as show, season and episode number, and title', () => {
    const title = formatProgramTitle(
      makeProgram({
        episode: 7,
        seasonNumber: 8,
        showTitle: 'The Simpsons',
        title: "Lisa's Date with Density",
      }),
    );

    expect(title).toBe("The Simpsons · S08E07 · Lisa's Date with Density");
  });

  it('uses joined grouping metadata when it is available', () => {
    const title = formatProgramTitle(
      makeProgram({
        episode: 2,
        season: { index: 11 },
        show: { title: 'Bob’s Burgers' },
        showTitle: 'Stale show title',
        title: 'The Belchies',
      }),
    );

    expect(title).toBe('Bob’s Burgers · S11E02 · The Belchies');
  });

  it('uses the title alone for movies and other videos', () => {
    expect(
      formatProgramTitle(makeProgram({ title: 'Alien', type: 'movie' })),
    ).toBe('Alien');
  });
});

describe('program title input', () => {
  it('escapes a textfile path for the drawtext filter', () => {
    expect(escapeDrawtextFilePath("C:\\Tunarr's,data[1];x\\title.txt")).toBe(
      "C\\:/Tunarr\\'s\\,data\\[1\\]\\;x/title.txt",
    );
  });

  it('disables drawtext expansion and keeps the canvas transparent', () => {
    const source = programTitleLavfiSource('/cache/title.txt');
    expect(source).toContain('color=c=black@0.0:s=1600x96,format=rgba');
    expect(source).toContain("textfile='/cache/title.txt':expansion=none");
  });

  it('writes metadata to a cache file and returns a lavfi watermark input', async () => {
    const temporaryDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'tunarr-program-title-test-'),
    );
    temporaryDirectories.push(temporaryDirectory);

    const input = await createProgramTitleOverlayInput(
      makeProgram({
        episode: 7,
        seasonNumber: 8,
        showTitle: 'The Simpsons',
        title: "Lisa's Date with 100% Density",
      }),
      {
        duration: 5,
        enabled: true,
        horizontalMargin: 2,
        opacity: 100,
        position: 'bottom-left',
        source: 'program-title',
        verticalMargin: 6,
        width: 75,
      },
      temporaryDirectory,
    );

    expect(input).toBeDefined();
    expect(input?.source.type).toBe('filter');
    expect(input?.streams[0]?.inputKind).toBe('filter');
    expect(input?.getInputOptions()).toEqual(['-f', 'lavfi']);
    expect(input?.path).toContain('expansion=none');

    const cacheDirectory = path.join(
      temporaryDirectory,
      'cache',
      'program-title-overlays',
    );
    const files = await fs.readdir(cacheDirectory);
    expect(files).toHaveLength(1);
    const titleFile = files[0];
    if (!titleFile) {
      throw new Error('Expected a cached program title file');
    }
    expect(
      await fs.readFile(path.join(cacheDirectory, titleFile), 'utf8'),
    ).toBe("The Simpsons · S08E07 · Lisa's Date with 100% Density");
  });
});
