import {
  BingePreset,
  BuiltInPresets,
  ClassicTvDayPreset,
  GenrePreset,
  WeightedMixPreset,
} from '@tunarr/shared/channel-templates';
import { describe, expect, test } from 'vitest';
import {
  blockLimits,
  canExportPreset,
  parseChannelTemplate,
  templateFileName,
  toChannelTemplate,
  type WizardTemplateState,
} from './channelTemplate.ts';

function state(overrides: Partial<WizardTemplateState>): WizardTemplateState {
  return {
    preset: GenrePreset,
    channelName: '',
    weightedGroups: [],
    timeBlocks: [],
    roleSelections: {},
    ...overrides,
  };
}

function roundTrip(s: WizardTemplateState, roles: string[]) {
  const text = JSON.stringify(toChannelTemplate(s, roles));
  return parseChannelTemplate(text, BuiltInPresets);
}

function importError(template: unknown): string | undefined {
  const parsed = parseChannelTemplate(JSON.stringify(template), BuiltInPresets);
  return parsed.ok ? undefined : parsed.error;
}

describe('toChannelTemplate', () => {
  test('keeps picks and drops server-specific scope and shows', () => {
    const template = toChannelTemplate(
      state({
        channelName: '  Sci-Fi Nights ',
        roleSelections: {
          content: {
            facetField: 'genre',
            facetValues: ['Science Fiction'],
            pickerFilter: 'genre = "Science Fiction"',
            advancedFilter: '',
            show: { id: 'show-1', title: 'Firefly', year: 2002 },
            override: { libraryIds: ['lib-1'], mediaSourceIds: ['ms-1'] },
          },
        },
      }),
      ['content'],
    );

    expect(template).toEqual({
      formatVersion: 1,
      presetId: 'genre-channel',
      channelName: 'Sci-Fi Nights',
      weightedGroups: undefined,
      timeBlocks: undefined,
      roles: {
        content: {
          facetField: 'genre',
          facetValues: ['Science Fiction'],
          yearRange: undefined,
          pickerFilter: 'genre = "Science Fiction"',
          advancedFilter: undefined,
        },
      },
    });
  });

  test('leaves out selections for roles the channel no longer has', () => {
    const template = toChannelTemplate(
      state({ roleSelections: { content: {}, stale: { facetValues: ['x'] } } }),
      ['content'],
    );
    expect(Object.keys(template.roles)).toEqual(['content']);
  });
});

describe('parseChannelTemplate', () => {
  test('restores a facet preset', () => {
    const parsed = roundTrip(
      state({
        channelName: 'Comedy',
        roleSelections: {
          content: {
            facetField: 'studio',
            facetValues: ['A24'],
            pickerFilter: 'studio = "A24"',
          },
        },
      }),
      ['content'],
    );

    expect(parsed).toEqual({
      ok: true,
      state: {
        preset: GenrePreset,
        channelName: 'Comedy',
        weightedGroups: [],
        timeBlocks: [],
        roleSelections: {
          content: {
            facetField: 'studio',
            facetValues: ['A24'],
            pickerFilter: 'studio = "A24"',
          },
        },
      },
    });
  });

  test('restores weighted mix groups', () => {
    const groups = [
      { role: 'group_1', label: 'Cartoons', weight: 3 },
      { role: 'group_2', label: 'Sitcoms', weight: 1 },
    ];
    const parsed = roundTrip(
      state({
        preset: WeightedMixPreset,
        weightedGroups: groups,
        roleSelections: { group_2: { advancedFilter: 'year > 1990' } },
      }),
      ['group_1', 'group_2'],
    );

    expect(parsed.ok && parsed.state.weightedGroups).toEqual(groups);
    expect(parsed.ok && parsed.state.roleSelections).toEqual({
      group_2: { advancedFilter: 'year > 1990' },
    });
  });

  test('restores classic TV time blocks', () => {
    const blocks = [
      { role: 'morning', label: 'Morning', startTime: 6 * 3_600_000 },
      { role: 'night', label: 'Night', startTime: 20 * 3_600_000 },
    ];
    const parsed = roundTrip(
      state({ preset: ClassicTvDayPreset, timeBlocks: blocks }),
      ['morning', 'night'],
    );

    expect(parsed.ok && parsed.state.timeBlocks).toEqual(blocks);
  });

  test('rejects text that is not JSON', () => {
    expect(parseChannelTemplate('{nope', BuiltInPresets)).toEqual({
      ok: false,
      error: "This file isn't valid JSON.",
    });
  });

  test('rejects JSON that is not a template', () => {
    expect(importError({ name: 'channel' })).toBe(
      "This file isn't a Tunarr channel template.",
    );
  });

  test('rejects a template from a newer format', () => {
    expect(
      importError({ formatVersion: 2, presetId: 'genre-channel', roles: {} }),
    ).toMatch(/newer version of Tunarr/);
  });

  test('rejects a malformed template', () => {
    expect(
      importError({ formatVersion: 1, presetId: 'genre-channel' }),
    ).toMatch(/malformed/);
  });

  test('rejects a preset this server does not have', () => {
    expect(
      importError({ formatVersion: 1, presetId: 'mystery', roles: {} }),
    ).toMatch(/"mystery" style/);
  });

  test('rejects binge templates', () => {
    expect(
      importError({ formatVersion: 1, presetId: BingePreset.id, roles: {} }),
    ).toBe("Binge Channel templates aren't supported yet.");
  });

  test('rejects content for a role the preset lacks', () => {
    expect(
      importError({
        formatVersion: 1,
        presetId: 'genre-channel',
        roles: { primetime: {} },
      }),
    ).toMatch(/"primetime", which Genre Channel doesn't have/);
  });

  test('rejects a block count outside the preset limits', () => {
    expect(
      importError({
        formatVersion: 1,
        presetId: WeightedMixPreset.id,
        weightedGroups: [{ role: 'only', label: 'Only', weight: 1 }],
        roles: {},
      }),
    ).toMatch(/between 2 and 10 blocks, but this template has 1/);
  });

  test('rejects repeated block names', () => {
    expect(
      importError({
        formatVersion: 1,
        presetId: ClassicTvDayPreset.id,
        timeBlocks: [
          { role: 'a', label: 'A', startTime: 0 },
          { role: 'a', label: 'A again', startTime: 3_600_000 },
        ],
        roles: {},
      }),
    ).toBe('This template repeats a block name.');
  });

  test('rejects a start time past the end of the day', () => {
    expect(
      importError({
        formatVersion: 1,
        presetId: ClassicTvDayPreset.id,
        timeBlocks: [
          { role: 'a', label: 'A', startTime: 0 },
          { role: 'b', label: 'B', startTime: 24 * 3_600_000 },
        ],
        roles: {},
      }),
    ).toMatch(/malformed/);
  });
});

describe('canExportPreset', () => {
  test('blocks only presets that pick a specific show', () => {
    expect(
      BuiltInPresets.filter((p) => !canExportPreset(p)).map((p) => p.id),
    ).toEqual([BingePreset.id]);
  });
});

describe('blockLimits', () => {
  test('uses the preset limits', () => {
    expect(blockLimits(WeightedMixPreset)).toEqual({ min: 2, max: 10 });
    expect(blockLimits(ClassicTvDayPreset)).toEqual({ min: 2, max: 8 });
  });
});

describe('templateFileName', () => {
  test('slugs the channel name and falls back to the preset', () => {
    expect(
      templateFileName({
        formatVersion: 1,
        presetId: 'genre-channel',
        channelName: "Saturday Mornin' Cartoons!",
        roles: {},
      }),
    ).toBe('saturday-mornin-cartoons.tunarr-template.json');
    expect(
      templateFileName({
        formatVersion: 1,
        presetId: 'genre-channel',
        roles: {},
      }),
    ).toBe('genre-channel.tunarr-template.json');
  });
});
