import { describe, expect, test } from 'vitest';
import {
  fromSelectValue,
  toMultiSelectFilterValue,
} from './multiSelectFilterValue.ts';

describe('toMultiSelectFilterValue', () => {
  test('keeps the strings in an array', () => {
    expect(toMultiSelectFilterValue(['error', 'warn'])).toEqual([
      'error',
      'warn',
    ]);
    expect(toMultiSelectFilterValue(['error', 3, null])).toEqual(['error']);
  });

  test.each([
    ['undefined', undefined],
    ['a string', 'error'],
    ['an object', { error: true }],
  ])('treats %s as nothing selected', (_, value) => {
    expect(toMultiSelectFilterValue(value)).toEqual([]);
  });
});

describe('fromSelectValue', () => {
  test('passes a selection through', () => {
    expect(fromSelectValue(['error'])).toEqual(['error']);
  });

  test('splits an autofilled string', () => {
    expect(fromSelectValue('error,warn')).toEqual(['error', 'warn']);
  });

  test.each([
    ['an empty array', []],
    ['an empty string', ''],
    ['undefined', undefined],
  ])('clears the filter for %s', (_, value) => {
    expect(fromSelectValue(value)).toBeUndefined();
  });
});
