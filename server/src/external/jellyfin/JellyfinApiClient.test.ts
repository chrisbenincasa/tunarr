import type { JellyfinItem as ApiJellyfinItem } from '@tunarr/types/jellyfin';
import { describe, expect, it } from 'vitest';
import { getJellyfinItemPersonMap } from './JellyfinApiClient.js';

const mediaSourceUrl = 'http://jellyfin.example';

type JellyfinPersonInput = NonNullable<ApiJellyfinItem['People']>[number];

function person(
  partial: Partial<JellyfinPersonInput> & Pick<JellyfinPersonInput, 'Id'>,
): JellyfinPersonInput {
  return partial as JellyfinPersonInput;
}

describe('getJellyfinItemPersonMap', () => {
  it('omits people with empty, whitespace, or missing names', () => {
    const mapping = getJellyfinItemPersonMap(
      {
        People: [
          person({
            Id: '1',
            Name: 'Alice',
            Type: 'Actor',
            Role: 'Hero',
          }),
          person({ Id: '2', Name: '', Type: 'Actor' }),
          person({ Id: '3', Type: 'Actor' }),
          person({ Id: '4', Name: 'Bob', Type: 'Writer' }),
          person({ Id: '5', Name: '', Type: 'Writer' }),
          person({ Id: '6', Name: 'Carol', Type: 'Director' }),
          person({ Id: '7', Name: '   ', Type: 'Director' }),
        ],
      } as ApiJellyfinItem,
      mediaSourceUrl,
    );

    expect(mapping.actor).toEqual([
      {
        name: 'Alice',
        role: 'Hero',
        thumb: `${mediaSourceUrl}/Items/1/Images/Primary`,
        order: 0,
      },
    ]);
    expect(mapping.writer).toEqual([
      {
        name: 'Bob',
        thumb: `${mediaSourceUrl}/Items/4/Images/Primary`,
      },
    ]);
    expect(mapping.director).toEqual([
      {
        name: 'Carol',
        thumb: `${mediaSourceUrl}/Items/6/Images/Primary`,
      },
    ]);
  });

  it('preserves actor order indexes from the unfiltered people list', () => {
    const mapping = getJellyfinItemPersonMap(
      {
        People: [
          person({ Id: '1', Name: 'Alice', Type: 'Actor' }),
          person({ Id: '2', Name: '', Type: 'Actor' }),
          person({ Id: '3', Name: 'Dave', Type: 'Actor' }),
        ],
      } as ApiJellyfinItem,
      mediaSourceUrl,
    );

    expect(mapping.actor?.map((actor) => [actor.name, actor.order])).toEqual([
      ['Alice', 0],
      ['Dave', 2],
    ]);
  });
});
