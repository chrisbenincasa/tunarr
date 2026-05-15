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
      conditions: [
        { type: 'program_type', operator: 'neq', value: 'episode' },
      ],
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
      conditions: [
        { type: 'subtitle_language', operator: 'in', value: 'jpn' },
      ],
    };
    expect(basicConditionToCel(group)).toBe('"jpn" in subtitle.languages');
  });

  it('generates audio channels exists', () => {
    const group: ConditionGroup = {
      type: 'group',
      operator: 'and',
      conditions: [
        { type: 'audio_channels', operator: 'gte', value: 6 },
      ],
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
      conditions: [
        { type: 'program_type', operator: 'eq', value: 'movie' },
      ],
    });
  });

  it('parses audio language in', () => {
    const result = celToBasicCondition('"eng" in audio.languages');
    expect(result).toEqual({
      type: 'group',
      operator: 'and',
      conditions: [
        { type: 'audio_language', operator: 'in', value: 'eng' },
      ],
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
      conditions: [
        { type: 'audio_channels', operator: 'gte', value: 6 },
      ],
    });
  });

  it('returns null for unrecognized expression', () => {
    expect(celToBasicCondition('some.unknown.field == 42')).toBeNull();
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
      conditions: [
        { type: 'program_type', operator: 'eq', value: 'movie' },
      ],
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
  ];

  cases.forEach((group, i) => {
    it(`round-trips case ${i}`, () => {
      const cel = basicConditionToCel(group);
      const parsed = celToBasicCondition(cel);
      expect(parsed).toEqual(group);
    });
  });
});
