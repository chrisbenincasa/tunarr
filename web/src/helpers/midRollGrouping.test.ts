import type { ChannelProgram, FillerProgram, FlexProgram } from '@tunarr/types';
import { describe, expect, test } from 'vitest';
import { makeContentProgram, makeMovie } from '../test/programFixtures.ts';
import type { UIChannelProgram } from '../types/index.ts';
import { groupMidRollItems, type MidRollGroup } from './midRollGrouping.ts';

const oneMin = 60 * 1000;

let nextIndex = 0;

function withUiFields(program: ChannelProgram): UIChannelProgram {
  const index = nextIndex++;
  return {
    ...program,
    uiIndex: index,
    originalIndex: index,
    startTimeOffset: 0,
  };
}

function segment(id: string, durationMs: number, startOffsetMs: number) {
  return withUiFields({
    ...makeContentProgram(makeMovie({ uuid: id }), durationMs, id),
    startOffsetMs,
  });
}

function midFiller(id: string, durationMs: number) {
  return withUiFields({
    type: 'filler',
    id,
    fillerListId: 'filler-list-1',
    fillerType: 'mid',
    duration: durationMs,
  } satisfies FillerProgram);
}

function flex(durationMs: number, midRoll = false) {
  return withUiFields({
    type: 'flex',
    duration: durationMs,
    fillerConfig: midRoll ? { origin: 'midroll' } : undefined,
  } satisfies FlexProgram);
}

function onlyGroup(items: UIChannelProgram[]): MidRollGroup {
  const displayItems = groupMidRollItems(items);
  const groups = displayItems.filter((i) => i.kind === 'mid-roll-group');
  expect(groups).toHaveLength(1);
  return groups[0].group;
}

describe('groupMidRollItems', () => {
  test('groups segments separated by eager mid filler', () => {
    const items = [
      segment('ep1', 8 * oneMin, 0),
      midFiller('bumper-1', 30 * 1000),
      segment('ep1', 8 * oneMin, 8 * oneMin),
      midFiller('bumper-2', 30 * 1000),
      segment('ep1', 4 * oneMin, 16 * oneMin),
    ];

    const group = onlyGroup(items);
    expect(group.items).toEqual(items);
    expect(group.breakCount).toBe(2);
    expect(group.totalDuration).toBe(20 * oneMin + 60 * 1000);
  });

  test('absorbs the flex left over by a partially filled break', () => {
    const items = [
      segment('ep1', 8 * oneMin, 0),
      midFiller('bumper-1', 10 * 1000),
      // The mid filler list had nothing else short enough for the break.
      flex(20 * 1000),
      segment('ep1', 8 * oneMin, 8 * oneMin),
    ];

    const group = onlyGroup(items);
    expect(group.items).toEqual(items);
    expect(group.breakCount).toBe(1);
  });

  test('groups lazy breaks, which are flex carrying a mid-roll origin', () => {
    const items = [
      segment('ep1', 8 * oneMin, 0),
      flex(30 * 1000, true),
      segment('ep1', 8 * oneMin, 8 * oneMin),
    ];

    const group = onlyGroup(items);
    expect(group.items).toEqual(items);
    expect(group.breakCount).toBe(1);
  });

  test('leaves ordinary flex between two programs alone', () => {
    const items = [
      segment('ep1', 20 * oneMin, 0),
      flex(10 * oneMin),
      segment('ep2', 20 * oneMin, 0),
    ];

    expect(groupMidRollItems(items)).toEqual(
      items.map((program) => ({ kind: 'program', program })),
    );
  });

  test('does not group a break that no segment of the same program follows', () => {
    // Post-roll-looking filler after the last segment belongs to the lineup,
    // not to the program above it.
    const items = [
      segment('ep1', 20 * oneMin, 0),
      midFiller('bumper-1', 30 * 1000),
      segment('ep2', 20 * oneMin, 0),
    ];

    expect(groupMidRollItems(items)).toEqual(
      items.map((program) => ({ kind: 'program', program })),
    );
  });

  test('keeps groups separate for consecutive programs with breaks', () => {
    const items = [
      segment('ep1', 8 * oneMin, 0),
      midFiller('bumper-1', 30 * 1000),
      segment('ep1', 8 * oneMin, 8 * oneMin),
      flex(10 * oneMin),
      segment('ep2', 8 * oneMin, 0),
      midFiller('bumper-2', 30 * 1000),
      segment('ep2', 8 * oneMin, 8 * oneMin),
    ];

    const displayItems = groupMidRollItems(items);
    expect(displayItems.map((i) => i.kind)).toEqual([
      'mid-roll-group',
      'program',
      'mid-roll-group',
    ]);
  });
});
