import type { SearchFilterValueNode } from '@tunarr/types/schemas';
import { describe, expect, test } from 'vitest';
import { LanguageCodeSearchFilterMutator } from './LanguageCodeSearchFilterMutator.ts';

const mutator = new LanguageCodeSearchFilterMutator();

function node(key: string, op: string, value: string[]): SearchFilterValueNode {
  return {
    type: 'value',
    fieldSpec: { key, name: key, type: 'faceted_string', op, value },
  };
}

describe('LanguageCodeSearchFilterMutator', () => {
  test('applies to the audio_language and subtitle_language virtual keys', () => {
    expect(mutator.appliesTo(node('audio_language', '=', ['ger']))).toBe(true);
    expect(mutator.appliesTo(node('subtitle_language', '=', ['ger']))).toBe(
      true,
    );
  });

  test('does not apply to index fields or unrelated fields', () => {
    expect(mutator.appliesTo(node('audioLanguages', '=', ['deu']))).toBe(false);
    expect(mutator.appliesTo(node('subtitleLanguages', '=', ['deu']))).toBe(
      false,
    );
    expect(mutator.appliesTo(node('genre', '=', ['Drama']))).toBe(false);
  });

  test('normalizes a /B value to /T and keeps the virtual key (ger -> deu)', () => {
    const out = mutator.mutate(node('audio_language', '=', ['ger']));
    expect(out.fieldSpec.value).toEqual(['deu']);
    expect(out.fieldSpec.key).toBe('audio_language');
  });

  test('leaves an already-/T value unchanged (deu -> deu)', () => {
    expect(
      mutator.mutate(node('audio_language', '=', ['deu'])).fieldSpec.value,
    ).toEqual(['deu']);
  });

  test('covers in and not in across a value list', () => {
    expect(
      mutator.mutate(node('audio_language', 'in', ['ger', 'fre'])).fieldSpec
        .value,
    ).toEqual(['deu', 'fra']);
    expect(
      mutator.mutate(node('subtitle_language', 'not in', ['dut'])).fieldSpec
        .value,
    ).toEqual(['nld']);
  });

  test('keeps an unresolvable value so it fails the same way as on write', () => {
    expect(
      mutator.mutate(node('audio_language', '=', ['zzz'])).fieldSpec.value,
    ).toEqual(['zzz']);
  });
});
