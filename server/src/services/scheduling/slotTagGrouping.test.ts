import type { BaseMovieProgrammingSlot, SlotGroupBy } from '@tunarr/types/api';
import { MersenneTwister19937, Random } from 'random-js';
import { describe, expect, test } from 'vitest';
import type { TagRelationWithTag } from '../../db/schema/derivedTypes.ts';
import { createFakeProgramOrm } from '../../testing/fakes/entityCreators.ts';
import type { SlotSchedulerProgram } from './slotSchedulerUtil.js';
import {
  createProgramMap,
  createSlotProgramIterator,
} from './slotSchedulerUtil.js';

function tagRelation(
  programId: string,
  tag: string,
  source: TagRelationWithTag['source'] = 'collection',
): TagRelationWithTag {
  return {
    tagId: `tag-${tag}`,
    programId,
    groupingId: null,
    source,
    tag: { uuid: `tag-${tag}`, tag },
  };
}

function movie(
  uuid: string,
  originalAirDate: string,
  tags: string[],
): SlotSchedulerProgram {
  return {
    ...createFakeProgramOrm({
      uuid,
      title: uuid,
      type: 'movie',
      originalAirDate,
      duration: 90 * 60 * 1000,
    }),
    tags: tags.map((tag) => tagRelation(uuid, tag)),
    parentFillerLists: [],
    parentCustomShows: [],
    parentSmartCollections: [],
  };
}

const programs = [
  movie('rocky-2', '1979-06-15', ['Rocky']),
  movie('alien', '1979-05-25', ['Alien', 'Sci-Fi']),
  movie('rocky', '1976-11-21', ['Rocky']),
  movie('aliens', '1986-07-18', ['Sci-Fi', 'Alien']),
  movie('blade-runner', '1982-06-25', ['Sci-Fi']),
  movie('heat', '1995-12-15', []),
];

function lineupFor(
  groupBy: Partial<SlotGroupBy>,
  order: BaseMovieProgrammingSlot['order'] = 'alphanumeric',
  inputPrograms: SlotSchedulerProgram[] = programs,
) {
  const iterator = createSlotProgramIterator(
    {
      type: 'movie',
      order,
      direction: 'asc',
      groupBy: {
        type: 'tag',
        ungrouped: 'include',
        multiTagBehavior: 'first',
        ...groupBy,
      },
    },
    createProgramMap(inputPrograms),
    new Random(MersenneTwister19937.seed(42)),
  );

  const ids: string[] = [];
  for (let i = 0; i < 40; i++) {
    const current = iterator.current({ slotDuration: 0, timeCursor: 0 });
    if (current?.type === 'content') {
      ids.push(current.id);
    }
    iterator.next();
  }

  // The iterator loops forever; return a single cycle of it.
  const period = ids.findIndex(
    (_, p) => p > 0 && ids.every((id, i) => id === ids[i % p]),
  );
  return period > 0 ? ids.slice(0, period) : ids;
}

describe('slot tag grouping', () => {
  test('first: each program plays once, under its A-Z first tag', () => {
    expect(lineupFor({ multiTagBehavior: 'first' })).toEqual([
      'alien',
      'aliens',
      'rocky',
      'rocky-2',
      'blade-runner',
      'heat',
    ]);
  });

  test('first: picked tag does not depend on tag order from the source', () => {
    const reversed = programs.map((program) => ({
      ...program,
      tags: [...(program.tags ?? [])].reverse(),
    }));
    expect(
      lineupFor({ multiTagBehavior: 'first' }, 'alphanumeric', reversed),
    ).toEqual(lineupFor({ multiTagBehavior: 'first' }));
  });

  test('all: programs repeat in every tag marathon they belong to', () => {
    expect(lineupFor({ multiTagBehavior: 'all' })).toEqual([
      'alien',
      'aliens',
      'rocky',
      'rocky-2',
      'alien',
      'blade-runner',
      'aliens',
      'heat',
    ]);
  });

  test('all_unique: programs play once, in the first marathon to come up', () => {
    expect(lineupFor({ multiTagBehavior: 'all_unique' })).toEqual([
      'alien',
      'aliens',
      'rocky',
      'rocky-2',
      'blade-runner',
      'heat',
    ]);
  });

  test('ungrouped exclude drops untagged programs', () => {
    expect(lineupFor({ ungrouped: 'exclude' })).not.toContain('heat');
  });

  test('chronological orders groups by their earliest program', () => {
    expect(lineupFor({ multiTagBehavior: 'first' }, 'chronological')).toEqual([
      'rocky',
      'rocky-2',
      'alien',
      'aliens',
      'blade-runner',
      'heat',
    ]);
  });

  test('a tag stored as both media and collection forms one group', () => {
    const doubled = movie('rocky-3', '1982-05-28', []);
    doubled.tags = [
      tagRelation('rocky-3', 'Rocky', 'media'),
      tagRelation('rocky-3', 'Rocky', 'collection'),
    ];
    expect(
      lineupFor({ multiTagBehavior: 'all' }, 'alphanumeric', [
        ...programs,
        doubled,
      ]).filter((id) => id === 'rocky-3'),
    ).toHaveLength(1);
  });

  test('shuffle keeps each marathon together', () => {
    const lineup = lineupFor({ multiTagBehavior: 'first' }, 'shuffle');
    const rockyStart = lineup.indexOf('rocky');
    expect(lineup[rockyStart + 1]).toBe('rocky-2');
    const alienStart = lineup.indexOf('alien');
    expect(lineup[alienStart + 1]).toBe('aliens');
  });
});
