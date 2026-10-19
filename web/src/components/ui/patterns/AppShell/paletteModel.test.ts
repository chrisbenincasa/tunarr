import { describe, expect, test } from 'vitest';
import { filterPalette, type PaletteItem } from './paletteModel.ts';

const item = (group: string, label: string, number?: string): PaletteItem => ({
  id: `${group}:${label}`,
  group,
  label,
  kind: group,
  number,
});

const items = [
  item('Pages', 'Filler Lists'),
  item('Channels', 'Classic Sci-Fi', '12'),
  item('Channels', 'Sci-Fi Marathon', '4'),
  item('Channels', 'Comedy Central'),
  item('Custom Shows', 'Sci-Fi Shorts'),
];

const labels = (query: string) =>
  filterPalette(items, query).map((g) => [g.name, g.items.map((i) => i.label)]);

describe('filterPalette', () => {
  test('matches case-insensitively and keeps group order', () => {
    expect(labels('SCI')).toEqual([
      ['Channels', ['Sci-Fi Marathon', 'Classic Sci-Fi']],
      ['Custom Shows', ['Sci-Fi Shorts']],
    ]);
  });

  test('ranks label prefixes over word prefixes over substrings', () => {
    expect(labels('c')[0]).toEqual([
      'Channels',
      ['Classic Sci-Fi', 'Comedy Central', 'Sci-Fi Marathon'],
    ]);
  });

  test('matches a channel by its exact number', () => {
    expect(labels('4')).toEqual([['Channels', ['Sci-Fi Marathon']]]);
  });

  test('keeps everything for an empty query', () => {
    expect(filterPalette(items, '  ').flatMap((g) => g.items)).toHaveLength(5);
  });

  test('caps each group', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      item('Channels', `Channel ${i}`),
    );
    expect(filterPalette(many, 'chan', 3)[0]?.items).toHaveLength(3);
  });
});
