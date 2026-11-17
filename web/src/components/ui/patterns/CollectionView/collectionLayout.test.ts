import { describe, expect, test } from 'vitest';
import { collectionLayout } from './collectionLayout.ts';

describe('collectionLayout', () => {
  test('shows cards at comfortable density', () => {
    expect(collectionLayout(false, false)).toBe('cards');
  });

  test('shows a table at dense density', () => {
    expect(collectionLayout(true, false)).toBe('table');
  });

  test('shows cards on a phone at either density', () => {
    expect(collectionLayout(false, true)).toBe('cards');
    expect(collectionLayout(true, true)).toBe('cards');
  });
});
