import { describe, expect, it } from 'vitest';
import { basicConditionToCel } from './celGenerator.ts';
import { celToBasicCondition } from './celParser.ts';
import type { ConditionGroup } from './types.ts';

describe('basicConditionToCel', () => {
  it('generates "true" for always clause', () => {
    const group: ConditionGroup = {
      type: 'group',
      operator: 'and',
      conditions: [{ type: 'always' }],
    };
    expect(basicConditionToCel(group)).toBe('true');
  });

  it('generates program type equality', () => {
    const group: ConditionGroup = {
      type: 'group',
      operator: 'and',
      conditions: [{ type: 'program_type', operator: 'eq', value: 'movie' }],
    };
    expect(basicConditionToCel(group)).toBe('program.type == "movie"');
  });

  it('generates program type inequality', () => {
    const group: ConditionGroup = {
      type: 'group',
      operator: 'and',
      conditions: [{ type: 'program_type', operator: 'neq', value: 'episode' }],
    };
    expect(basicConditionToCel(group)).toBe('program.type != "episode"');
  });

  it('generates audio language in', () => {
    const group: ConditionGroup = {
      type: 'group',
      operator: 'and',
      conditions: [{ type: 'audio_language', operator: 'in', value: 'eng' }],
    };
    expect(basicConditionToCel(group)).toBe('"eng" in audio.languages');
  });

  it('generates audio language not_in', () => {
    const group: ConditionGroup = {
      type: 'group',
      operator: 'and',
      conditions: [
        { type: 'audio_language', operator: 'not_in', value: 'eng' },
      ],
    };
    expect(basicConditionToCel(group)).toBe('!("eng" in audio.languages)');
  });

  it('generates subtitle language in', () => {
    const group: ConditionGroup = {
      type: 'group',
      operator: 'and',
      conditions: [{ type: 'subtitle_language', operator: 'in', value: 'jpn' }],
    };
    expect(basicConditionToCel(group)).toBe('"jpn" in subtitle.languages');
  });

  it('generates audio channels exists', () => {
    const group: ConditionGroup = {
      type: 'group',
      operator: 'and',
      conditions: [{ type: 'audio_channels', operator: 'gte', value: 6 }],
    };
    expect(basicConditionToCel(group)).toBe(
      'audio.streams.exists(s, s.channels >= 6)',
    );
  });

  it('generates AND of multiple clauses', () => {
    const group: ConditionGroup = {
      type: 'group',
      operator: 'and',
      conditions: [
        { type: 'program_type', operator: 'eq', value: 'movie' },
        { type: 'audio_language', operator: 'in', value: 'eng' },
      ],
    };
    expect(basicConditionToCel(group)).toBe(
      'program.type == "movie" && "eng" in audio.languages',
    );
  });

  it('generates OR of multiple clauses', () => {
    const group: ConditionGroup = {
      type: 'group',
      operator: 'or',
      conditions: [
        { type: 'program_type', operator: 'eq', value: 'movie' },
        { type: 'program_type', operator: 'eq', value: 'episode' },
      ],
    };
    expect(basicConditionToCel(group)).toBe(
      'program.type == "movie" || program.type == "episode"',
    );
  });

  it('wraps nested group with different operator in parens', () => {
    const group: ConditionGroup = {
      type: 'group',
      operator: 'and',
      conditions: [
        { type: 'program_type', operator: 'eq', value: 'movie' },
        {
          type: 'group',
          operator: 'or',
          conditions: [
            { type: 'audio_language', operator: 'in', value: 'eng' },
            { type: 'audio_language', operator: 'in', value: 'jpn' },
          ],
        },
      ],
    };
    expect(basicConditionToCel(group)).toBe(
      'program.type == "movie" && ("eng" in audio.languages || "jpn" in audio.languages)',
    );
  });
});

describe('basicConditionToCel program fields', () => {
  const single = (clause: ConditionGroup['conditions'][number]) =>
    basicConditionToCel({
      type: 'group',
      operator: 'and',
      conditions: [clause],
    });

  it('generates title comparisons', () => {
    expect(
      single({ type: 'program_title', operator: 'eq', value: 'Heat' }),
    ).toBe('program.title == "Heat"');
    expect(single({ type: 'show_title', operator: 'neq', value: 'Lost' })).toBe(
      'program.showTitle != "Lost"',
    );
    expect(
      single({ type: 'show_title', operator: 'contains', value: 'Star' }),
    ).toBe('program.showTitle.contains("Star")');
  });

  it('escapes quotes and backslashes in titles', () => {
    expect(
      single({ type: 'program_title', operator: 'eq', value: 'Say "Hi" \\o/' }),
    ).toBe('program.title == "Say \\"Hi\\" \\\\o/"');
  });

  it('generates genre membership', () => {
    expect(single({ type: 'genre', operator: 'in', value: 'Anime' })).toBe(
      '"Anime" in program.genres',
    );
    expect(single({ type: 'genre', operator: 'not_in', value: 'Horror' })).toBe(
      '!("Horror" in program.genres)',
    );
  });

  it('generates library comparisons', () => {
    expect(single({ type: 'library', operator: 'eq', value: 'lib-1' })).toBe(
      'program.libraryId == "lib-1"',
    );
  });
});

describe('celToBasicCondition', () => {
  it('parses "true"', () => {
    const result = celToBasicCondition('true');
    expect(result).toEqual({
      type: 'group',
      operator: 'and',
      conditions: [{ type: 'always' }],
    });
  });

  it('parses program type equality', () => {
    const result = celToBasicCondition('program.type == "movie"');
    expect(result).toEqual({
      type: 'group',
      operator: 'and',
      conditions: [{ type: 'program_type', operator: 'eq', value: 'movie' }],
    });
  });

  it('parses audio language in', () => {
    const result = celToBasicCondition('"eng" in audio.languages');
    expect(result).toEqual({
      type: 'group',
      operator: 'and',
      conditions: [{ type: 'audio_language', operator: 'in', value: 'eng' }],
    });
  });

  it('parses negated audio language', () => {
    const result = celToBasicCondition('!("eng" in audio.languages)');
    expect(result).toEqual({
      type: 'group',
      operator: 'and',
      conditions: [
        { type: 'audio_language', operator: 'not_in', value: 'eng' },
      ],
    });
  });

  it('parses AND conditions', () => {
    const result = celToBasicCondition(
      'program.type == "movie" && "eng" in audio.languages',
    );
    expect(result).toEqual({
      type: 'group',
      operator: 'and',
      conditions: [
        { type: 'program_type', operator: 'eq', value: 'movie' },
        { type: 'audio_language', operator: 'in', value: 'eng' },
      ],
    });
  });

  it('parses OR conditions', () => {
    const result = celToBasicCondition(
      'program.type == "movie" || program.type == "episode"',
    );
    expect(result).toEqual({
      type: 'group',
      operator: 'or',
      conditions: [
        { type: 'program_type', operator: 'eq', value: 'movie' },
        { type: 'program_type', operator: 'eq', value: 'episode' },
      ],
    });
  });

  it('parses nested groups', () => {
    const result = celToBasicCondition(
      'program.type == "movie" && ("eng" in audio.languages || "jpn" in audio.languages)',
    );
    expect(result).toEqual({
      type: 'group',
      operator: 'and',
      conditions: [
        { type: 'program_type', operator: 'eq', value: 'movie' },
        {
          type: 'group',
          operator: 'or',
          conditions: [
            { type: 'audio_language', operator: 'in', value: 'eng' },
            { type: 'audio_language', operator: 'in', value: 'jpn' },
          ],
        },
      ],
    });
  });

  it('parses audio channels exists', () => {
    const result = celToBasicCondition(
      'audio.streams.exists(s, s.channels >= 6)',
    );
    expect(result).toEqual({
      type: 'group',
      operator: 'and',
      conditions: [{ type: 'audio_channels', operator: 'gte', value: 6 }],
    });
  });

  it('returns null for unrecognized expression', () => {
    expect(celToBasicCondition('some.unknown.field == 42')).toBeNull();
  });

  it('parses program field clauses', () => {
    expect(
      celToBasicCondition(
        'program.showTitle.contains( "Star" ) && !("Horror" in program.genres)',
      )?.conditions,
    ).toEqual([
      { type: 'show_title', operator: 'contains', value: 'Star' },
      { type: 'genre', operator: 'not_in', value: 'Horror' },
    ]);
  });

  it('decodes escaped quotes', () => {
    expect(
      celToBasicCondition(String.raw`program.title == "a \"b\" && c"`)
        ?.conditions,
    ).toEqual([{ type: 'program_title', operator: 'eq', value: 'a "b" && c' }]);
  });

  it('returns null for CEL escapes the builder cannot decode', () => {
    expect(celToBasicCondition(String.raw`program.title == "\x41"`)).toBeNull();
  });

  it('returns null for single-quoted strings', () => {
    expect(celToBasicCondition("program.title == 'Heat'")).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(celToBasicCondition('')).toBeNull();
  });
});

describe('round-trip', () => {
  const cases: ConditionGroup[] = [
    { type: 'group', operator: 'and', conditions: [{ type: 'always' }] },
    {
      type: 'group',
      operator: 'and',
      conditions: [{ type: 'program_type', operator: 'eq', value: 'movie' }],
    },
    {
      type: 'group',
      operator: 'and',
      conditions: [
        { type: 'program_type', operator: 'eq', value: 'movie' },
        { type: 'audio_language', operator: 'in', value: 'eng' },
      ],
    },
    {
      type: 'group',
      operator: 'or',
      conditions: [
        { type: 'audio_language', operator: 'in', value: 'eng' },
        { type: 'audio_language', operator: 'in', value: 'jpn' },
      ],
    },
    {
      type: 'group',
      operator: 'and',
      conditions: [
        { type: 'program_type', operator: 'eq', value: 'episode' },
        {
          type: 'group',
          operator: 'or',
          conditions: [
            { type: 'audio_language', operator: 'in', value: 'eng' },
            { type: 'subtitle_language', operator: 'in', value: 'eng' },
          ],
        },
      ],
    },
    {
      type: 'group',
      operator: 'or',
      conditions: [
        { type: 'program_title', operator: 'contains', value: 'Tom & "Jerry"' },
        { type: 'show_title', operator: 'eq', value: 'Back\\slash || (x)' },
        { type: 'genre', operator: 'in', value: 'Science Fiction' },
        { type: 'library', operator: 'neq', value: 'lib-1' },
      ],
    },
  ];

  cases.forEach((group, i) => {
    it(`round-trips case ${i}`, () => {
      const cel = basicConditionToCel(group);
      const parsed = celToBasicCondition(cel);
      expect(parsed).toEqual(group);
    });
  });
});
