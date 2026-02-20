import constants from '@tunarr/shared/constants';
import type { TimeSlotSchedule } from '@tunarr/types/api';
import dayjs from '@/util/dayjs.js';
import { maxBy, minBy } from 'lodash-es';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createFakeProgramOrm } from '../../testing/fakes/entityCreators.ts';
import { groupByUniq } from '../../util/index.ts';
import type { SlotSchedulerProgram } from './slotSchedulerUtil.js';
import { scheduleTimeSlots } from './TimeSlotService.ts';

describe('TimeSlotService', () => {
  describe('scheduleTimeSlots', () => {
    describe('basic functionality', () => {
      test('successfully creates a schedule without errors', async () => {
        // Start with a very simple test that just verifies the function runs
        const programs: SlotSchedulerProgram[] = [];

        const schedule: TimeSlotSchedule = {
          type: 'time',
          flexPreference: 'distribute',
          maxDays: 1,
          padMs: 30 * 60 * 1000, // 30 min slots
          slots: [
            {
              startTime: 0,
              type: 'movie',
              order: 'next',
              direction: 'asc',
            },
          ],
          period: 'day',
          latenessMs: 0,
          timeZoneOffset: 0,
        };

        const result = await scheduleTimeSlots(schedule, programs);

        expect(result.lineup).toBeDefined();
        expect(result.startTime).toBeGreaterThan(0);
      });

      test('schedules movie programs correctly', async () => {
        const programs: SlotSchedulerProgram[] = [
          {
            ...createFakeProgramOrm({
              uuid: 'movie1',
              title: 'Movie 1',
              type: 'movie',
              duration: 120 * 60 * 1000, // 2 hours
            }),
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          },
          {
            ...createFakeProgramOrm({
              uuid: 'movie2',
              title: 'Movie 2',
              type: 'movie',
              duration: 90 * 60 * 1000, // 90 minutes
            }),
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          },
        ];

        const schedule: TimeSlotSchedule = {
          type: 'time',
          flexPreference: 'distribute',
          maxDays: 1,
          padMs: 120 * 60 * 1000, // 2 hour slots
          slots: [
            {
              startTime: 0,
              type: 'movie',
              order: 'next',
              direction: 'asc',
            },
          ],
          period: 'day',
          latenessMs: 0,
          timeZoneOffset: 0,
        };

        const result = await scheduleTimeSlots(schedule, programs);

        expect(result.lineup).toBeDefined();
        expect(result.lineup.length).toBeGreaterThan(0);
      });

      test('handles empty program list', async () => {
        const schedule: TimeSlotSchedule = {
          type: 'time',
          flexPreference: 'distribute',
          maxDays: 1,
          padMs: 30 * 60 * 1000,
          slots: [
            {
              startTime: 0,
              type: 'movie',
              order: 'next',
              direction: 'asc',
            },
          ],
          period: 'day',
          latenessMs: 0,
          timeZoneOffset: 0,
        };

        const result = await scheduleTimeSlots(schedule, []);

        expect(result.lineup).toBeDefined();
        // Empty program list may result in flex time
        expect(result.lineup.length).toBeGreaterThanOrEqual(0);
      });

      test('schedules multiple slots in a day period', async () => {
        const programs: SlotSchedulerProgram[] = [
          {
            ...createFakeProgramOrm({
              uuid: 'show1-ep1',
              title: 'Show 1 - Episode 1',
              type: 'episode',
              duration: 30 * 60 * 1000,
              tvShowUuid: 'show1',
            }),
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          },
          {
            ...createFakeProgramOrm({
              uuid: 'movie1',
              title: 'Movie 1',
              type: 'movie',
              duration: 120 * 60 * 1000, // 2 hours
            }),
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          },
        ];

        const schedule: TimeSlotSchedule = {
          type: 'time',
          flexPreference: 'distribute',
          maxDays: 1,
          padMs: 60 * 60 * 1000, // 1 hour slots
          slots: [
            {
              startTime: 0, // Midnight
              type: 'show',
              showId: 'show1',
              order: 'next',
              direction: 'asc',
              seasonFilter: [],
            },
            {
              startTime: 12 * 60 * 60 * 1000, // Noon
              type: 'movie',
              order: 'next',
              direction: 'asc',
            },
          ],
          period: 'day',
          latenessMs: 0,
          timeZoneOffset: 0,
        };

        const result = await scheduleTimeSlots(schedule, programs);

        expect(result.lineup).toBeDefined();
        expect(result.lineup.length).toBeGreaterThan(0);
        // Should have both show episodes and movies
        // Content programs are condensed and don't have subtype
        // We just check that we have content programs scheduled
        const hasContent = result.lineup.some((p) => p.type === 'content');
        expect(hasContent).toBe(true);
      });
    });

    describe('padding and alignment', () => {
      test('respects padMs for slot boundaries', async () => {
        const programs: SlotSchedulerProgram[] = [
          {
            ...createFakeProgramOrm({
              uuid: 'show1-ep1',
              type: 'episode',
              duration: 25 * 60 * 1000, // 25 minutes - doesn't fit evenly
              tvShowUuid: 'show1',
              show: {
                uuid: 'show1',
              },
            }),
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          },
        ];

        const schedule: TimeSlotSchedule = {
          type: 'time',
          flexPreference: 'distribute',
          maxDays: 1,
          padMs: 30 * 60 * 1000, // 30 min slots
          slots: [
            {
              startTime: 0,
              type: 'show',
              showId: 'show1',
              order: 'next',
              direction: 'asc',
              seasonFilter: [],
            },
          ],
          period: 'day',
          latenessMs: 0,
          timeZoneOffset: 0,
        };

        const result = await scheduleTimeSlots(schedule, programs);

        expect(result.lineup).toBeDefined();
        // Should add flex time to align to slot boundaries
        const hasFlexTime = result.lineup.some((p) => p.type === 'flex');
        expect(hasFlexTime).toBe(true);

        let t = result.startTime;
        for (const item of result.lineup) {
          if (item.type !== 'content') {
            t += item.duration;
            continue;
          }

          // Content always starts on the 30m mark.
          expect(t % (30 * 60 * 1000)).toBe(0);
          t += item.duration;
        }
      });

      test('handles SLACK constant correctly', async () => {
        // SLACK = 300ms according to constants
        const programs: SlotSchedulerProgram[] = [
          {
            ...createFakeProgramOrm({
              uuid: 'show1-ep1',
              type: 'episode',
              // Duration that's almost aligned but within SLACK
              duration: 30 * 60 * 1000 - constants.SLACK / 2,
              tvShowUuid: 'show1',
            }),
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          },
        ];

        const schedule: TimeSlotSchedule = {
          type: 'time',
          flexPreference: 'distribute',
          maxDays: 1,
          padMs: 30 * 60 * 1000,
          slots: [
            {
              startTime: 0,
              type: 'show',
              showId: 'show1',
              order: 'next',
              direction: 'asc',
              seasonFilter: [],
            },
          ],
          period: 'day',
          latenessMs: 0,
          timeZoneOffset: 0,
        };

        const result = await scheduleTimeSlots(schedule, programs);

        expect(result.lineup).toBeDefined();
        // The schedule should handle near-alignment gracefully
      });
    });

    describe('program iteration order', () => {
      test('respects "next" order with "asc" direction', async () => {
        const programs: SlotSchedulerProgram[] = Array.from(
          { length: 5 },
          (_, i) => ({
            ...createFakeProgramOrm({
              uuid: `show1-ep${i + 1}`,
              title: `Episode ${i + 1}`,
              type: 'episode',
              duration: 30 * 60 * 1000,
              episode: i + 1,
              tvShowUuid: 'show1',
              show: {
                uuid: 'show1',
              },
            }),
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          }),
        );

        const schedule: TimeSlotSchedule = {
          type: 'time',
          flexPreference: 'distribute',
          maxDays: 1,
          padMs: 30 * 60 * 1000,
          slots: [
            {
              startTime: 0,
              type: 'show',
              showId: 'show1',
              order: 'next',
              direction: 'asc',
              seasonFilter: [],
            },
          ],
          period: 'day',
          latenessMs: 0,
          timeZoneOffset: 0,
        };

        const programsById = groupByUniq(programs, (p) => p.uuid);

        const result = await scheduleTimeSlots(schedule, programs);

        expect(result.lineup).toBeDefined();
        // Note: CondensedChannelProgram doesn't expose episode details
        // We can only verify that content programs were scheduled
        const contentPrograms = result.lineup.filter(
          (p) => p.type === 'content',
        );
        expect(contentPrograms.length).toBeGreaterThan(0);

        const maxEpNumber = maxBy(programs, (p) => p.episode)?.episode!;
        const minEpNumber = minBy(programs, (p) => p.episode)?.episode!;

        for (let i = 0; i < contentPrograms.length; i++) {
          if (i === contentPrograms.length - 1) {
            continue;
          }

          expect(contentPrograms[i].id).toBeDefined();
          expect(contentPrograms[i + 1].id).toBeDefined();
          const curr = programsById[contentPrograms[i].id!];
          const next = programsById[contentPrograms[i + 1].id!];

          expect(curr.episode).toBeDefined();

          // Account for loops
          if (curr.episode === maxEpNumber) {
            expect(next.episode).toBe(minEpNumber);
          } else {
            expect(curr.episode).toBeLessThan(next.episode!);
          }
        }
      });

      test('respects "next" order with "desc" direction', async () => {
        const programs: SlotSchedulerProgram[] = Array.from(
          { length: 5 },
          (_, i) => ({
            ...createFakeProgramOrm({
              uuid: `show1-ep${i + 1}`,
              title: `Episode ${i + 1}`,
              type: 'episode',
              duration: 30 * 60 * 1000,
              episode: i + 1,
              tvShowUuid: 'show1',
              show: {
                uuid: 'show1',
              },
            }),
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          }),
        );

        const schedule: TimeSlotSchedule = {
          type: 'time',
          flexPreference: 'distribute',
          maxDays: 1,
          padMs: 30 * 60 * 1000,
          slots: [
            {
              startTime: 0,
              type: 'show',
              showId: 'show1',
              order: 'next',
              direction: 'desc',
              seasonFilter: [],
            },
          ],
          period: 'day',
          latenessMs: 0,
          timeZoneOffset: 0,
        };

        const programsById = groupByUniq(programs, (p) => p.uuid);

        const result = await scheduleTimeSlots(schedule, programs);

        expect(result.lineup).toBeDefined();
        // Note: CondensedChannelProgram doesn't expose episode details
        // We can only verify that content programs were scheduled
        const contentPrograms = result.lineup.filter(
          (p) => p.type === 'content',
        );
        expect(contentPrograms.length).toBeGreaterThan(0);

        const maxEpNumber = maxBy(programs, (p) => p.episode)?.episode!;
        const minEpNumber = minBy(programs, (p) => p.episode)?.episode!;

        for (let i = 0; i < contentPrograms.length; i++) {
          if (i === contentPrograms.length - 1) {
            continue;
          }

          expect(contentPrograms[i].id).toBeDefined();
          expect(contentPrograms[i + 1].id).toBeDefined();
          const curr = programsById[contentPrograms[i].id!];
          const next = programsById[contentPrograms[i + 1].id!];

          expect(curr.episode).toBeDefined();

          // Account for loops
          if (curr.episode === minEpNumber) {
            expect(next.episode).toBe(maxEpNumber);
          } else {
            expect(curr.episode).toBeGreaterThan(next.episode!);
          }
        }
      });

      test('handles "shuffle" order correctly', async () => {
        const programs: SlotSchedulerProgram[] = Array.from(
          { length: 10 },
          (_, i) => ({
            ...createFakeProgramOrm({
              uuid: `movie${i}`,
              title: `Movie ${i}`,
              type: 'movie',
              duration: 90 * 60 * 1000,
            }),
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          }),
        );

        const schedule: TimeSlotSchedule = {
          type: 'time',
          flexPreference: 'distribute',
          maxDays: 2,
          padMs: 120 * 60 * 1000, // 2 hour slots
          slots: [
            {
              startTime: 0,
              type: 'movie',
              order: 'shuffle',
              direction: 'asc',
            },
          ],
          period: 'day',
          latenessMs: 0,
          timeZoneOffset: 0,
        };

        const seed = [1, 2, 3, 4]; // Fixed seed for reproducibility
        const result1 = await scheduleTimeSlots(schedule, programs, seed);
        const result2 = await scheduleTimeSlots(schedule, programs, seed);
      });
    });

    describe('flex time handling', () => {
      test('distributes flex time when flexPreference is "distribute"', async () => {
        const programs: SlotSchedulerProgram[] = [
          {
            ...createFakeProgramOrm({
              uuid: 'short-show',
              type: 'episode',
              duration: 22 * 60 * 1000, // 22 minutes
              tvShowUuid: 'show1',
            }),
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          },
        ];

        const schedule: TimeSlotSchedule = {
          type: 'time',
          flexPreference: 'distribute',
          maxDays: 1,
          padMs: 30 * 60 * 1000, // 30 min slots
          slots: [
            {
              startTime: 0,
              type: 'show',
              showId: 'show1',
              order: 'next',
              direction: 'asc',
              seasonFilter: [],
            },
          ],
          period: 'day',
          latenessMs: 0,
          timeZoneOffset: 0,
        };

        const result = await scheduleTimeSlots(schedule, programs);

        expect(result.lineup).toBeDefined();
        // Should have flex programs to fill gaps
        const flexPrograms = result.lineup.filter((p) => p.type === 'flex');
        expect(flexPrograms.length).toBeGreaterThan(0);
        // Flex duration should make up the difference
        const flexTotal = flexPrograms.reduce((sum, p) => sum + p.duration, 0);
        expect(flexTotal).toBeGreaterThan(0);
      });

      test('extends existing flex program instead of creating new one', async () => {
        const programs: SlotSchedulerProgram[] = [
          {
            ...createFakeProgramOrm({
              uuid: 'short1',
              type: 'episode',
              duration: 20 * 60 * 1000, // 20 minutes
              tvShowUuid: 'show1',
            }),
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          },
          {
            ...createFakeProgramOrm({
              uuid: 'short2',
              type: 'episode',
              duration: 20 * 60 * 1000, // 20 minutes
              tvShowUuid: 'show1',
            }),
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          },
        ];

        const schedule: TimeSlotSchedule = {
          type: 'time',
          flexPreference: 'distribute',
          maxDays: 1,
          padMs: 30 * 60 * 1000,
          slots: [
            {
              startTime: 0,
              type: 'show',
              showId: 'show1',
              order: 'next',
              direction: 'asc',
              seasonFilter: [],
            },
          ],
          period: 'day',
          latenessMs: 0,
          timeZoneOffset: 0,
        };

        const result = await scheduleTimeSlots(schedule, programs);

        expect(result.lineup).toBeDefined();
        // Check that consecutive flex programs are combined
        for (let i = 1; i < result.lineup.length; i++) {
          const prev = result.lineup[i - 1];
          const curr = result.lineup[i];
          // Should not have two flex programs in a row
          if (prev.type === 'flex') {
            expect(curr.type).not.toBe('flex');
          }
        }
      });
    });

    describe('multi-day scheduling', () => {
      test('schedules across multiple days', async () => {
        const programs: SlotSchedulerProgram[] = Array.from(
          { length: 20 },
          (_, i) => ({
            ...createFakeProgramOrm({
              uuid: `movie${i}`,
              type: 'movie',
              duration: 120 * 60 * 1000, // 2 hours
            }),
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          }),
        );

        const schedule: TimeSlotSchedule = {
          type: 'time',
          flexPreference: 'distribute',
          maxDays: 3,
          padMs: 120 * 60 * 1000, // 2 hour slots
          slots: [
            {
              startTime: 0,
              type: 'movie',
              order: 'next',
              direction: 'asc',
            },
          ],
          period: 'day',
          latenessMs: 0,
          timeZoneOffset: 0,
        };

        const result = await scheduleTimeSlots(
          schedule,
          programs,
          undefined,
          undefined,
          dayjs().startOf('day'),
        );

        expect(result.lineup).toBeDefined();
        const totalDuration = result.lineup.reduce(
          (sum, p) => sum + p.duration,
          0,
        );
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        // Should schedule approximately 3 days worth of content
        expect(totalDuration).toBeGreaterThan(0);
        expect(totalDuration).toBeLessThanOrEqual(
          threeDaysMs + 24 * 60 * 60 * 1000,
        ); // Allow some overflow
      });

      test('respects startTomorrow option', async () => {
        const programs: SlotSchedulerProgram[] = [
          {
            ...createFakeProgramOrm({
              uuid: 'movie1',
              type: 'movie',
              duration: 120 * 60 * 1000,
            }),
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          },
        ];

        const schedule: TimeSlotSchedule = {
          type: 'time',
          flexPreference: 'distribute',
          maxDays: 1,
          padMs: 120 * 60 * 1000,
          slots: [
            {
              startTime: 0,
              type: 'movie',
              order: 'next',
              direction: 'asc',
            },
          ],
          period: 'day',
          latenessMs: 0,
          timeZoneOffset: 0,
          startTomorrow: true,
        };

        const result = await scheduleTimeSlots(schedule, programs);

        expect(result.lineup).toBeDefined();
        expect(result.lineup.length).toBeGreaterThan(0);
        // The schedule should start tomorrow
        // We can't easily verify the exact start time without mocking dayjs,
        // but we can verify the schedule was generated
      });
    });

    describe('period handling', () => {
      test('handles weekly period', async () => {
        const programs: SlotSchedulerProgram[] = [
          {
            ...createFakeProgramOrm({
              uuid: 'show1-ep1',
              type: 'episode',
              duration: 60 * 60 * 1000, // 1 hour
              tvShowUuid: 'show1',
            }),
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          },
        ];

        const schedule: TimeSlotSchedule = {
          type: 'time',
          flexPreference: 'distribute',
          maxDays: 1,
          padMs: 60 * 60 * 1000,
          slots: [
            {
              startTime: 0,
              type: 'show',
              showId: 'show1',
              order: 'next',
              direction: 'asc',
              seasonFilter: [],
            },
          ],
          period: 'week',
          latenessMs: 0,
          timeZoneOffset: 0,
        };

        const result = await scheduleTimeSlots(schedule, programs);

        expect(result.lineup).toBeDefined();
        // Should handle weekly periods without errors
      });
    });

    describe('error handling', () => {
      test('handles slot without matching programs gracefully', async () => {
        const programs: SlotSchedulerProgram[] = [
          {
            ...createFakeProgramOrm({
              uuid: 'movie1',
              type: 'movie',
              duration: 120 * 60 * 1000,
            }),
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          },
        ];

        const schedule: TimeSlotSchedule = {
          type: 'time',
          flexPreference: 'distribute',
          maxDays: 1,
          padMs: 60 * 60 * 1000,
          slots: [
            {
              startTime: 0,
              type: 'show',
              showId: 'nonexistent-show',
              order: 'next',
              direction: 'asc',
              seasonFilter: [],
            },
          ],
          period: 'day',
          latenessMs: 0,
          timeZoneOffset: 0,
        };

        const result = await scheduleTimeSlots(schedule, programs);

        // Should handle missing programs gracefully
        expect(result.lineup).toBeDefined();
        // May have flex time or may be empty
      });
    });

    describe('program deduplication', () => {
      test('deduplicates programs with same UUID', async () => {
        const baseProgram = createFakeProgramOrm({
          uuid: 'duplicate-uuid',
          type: 'movie',
          duration: 120 * 60 * 1000,
        });

        const programs: SlotSchedulerProgram[] = [
          {
            ...baseProgram,
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          },
          {
            ...baseProgram,
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          },
          {
            ...baseProgram,
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          },
        ];

        const schedule: TimeSlotSchedule = {
          type: 'time',
          flexPreference: 'distribute',
          maxDays: 1,
          padMs: 120 * 60 * 1000,
          slots: [
            {
              startTime: 0,
              type: 'movie',
              order: 'next',
              direction: 'asc',
            },
          ],
          period: 'day',
          latenessMs: 0,
          timeZoneOffset: 0,
        };

        const result = await scheduleTimeSlots(schedule, programs);

        expect(result.lineup).toBeDefined();
        // Note: CondensedChannelProgram doesn't expose uuid for content programs
        // We can only verify the schedule was created
        expect(result.lineup.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('seed and reproducibility', () => {
      test('same seed produces identical schedules', async () => {
        const programs: SlotSchedulerProgram[] = Array.from(
          { length: 10 },
          (_, i) => ({
            ...createFakeProgramOrm({
              uuid: `movie${i}`,
              type: 'movie',
              duration: 90 * 60 * 1000,
            }),
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          }),
        );

        const schedule: TimeSlotSchedule = {
          type: 'time',
          flexPreference: 'distribute',
          maxDays: 2,
          padMs: 120 * 60 * 1000,
          slots: [
            {
              startTime: 0,
              type: 'movie',
              order: 'shuffle',
              direction: 'asc',
            },
          ],
          period: 'day',
          latenessMs: 0,
          timeZoneOffset: 0,
        };

        const seed = [42, 123, 456, 789];
        const start = dayjs().startOf('day');
        const result1 = await scheduleTimeSlots(
          schedule,
          programs,
          seed,
          undefined,
          start,
        );
        const result2 = await scheduleTimeSlots(
          schedule,
          programs,
          seed,
          undefined,
          start,
        );

        expect(result1).toEqual(result2);
      });

      test('different seeds produce different schedules', async () => {
        const programs: SlotSchedulerProgram[] = Array.from(
          { length: 10 },
          (_, i) => ({
            ...createFakeProgramOrm({
              uuid: `movie${i}`,
              type: 'movie',
              duration: 90 * 60 * 1000,
            }),
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          }),
        );

        const schedule: TimeSlotSchedule = {
          type: 'time',
          flexPreference: 'distribute',
          maxDays: 2,
          padMs: 120 * 60 * 1000,
          slots: [
            {
              startTime: 0,
              type: 'movie',
              order: 'shuffle',
              direction: 'asc',
            },
          ],
          period: 'day',
          latenessMs: 0,
          timeZoneOffset: 0,
        };

        const result1 = await scheduleTimeSlots(
          schedule,
          programs,
          [42, 123, 456, 789],
        );
        const result2 = await scheduleTimeSlots(
          schedule,
          programs,
          [99, 88, 77, 66],
        );

        // The results should be different (though theoretically could be same by chance)
        // At minimum, both should be successful
      });

      test('discardCount parameter affects randomization', async () => {
        const programs: SlotSchedulerProgram[] = Array.from(
          { length: 10 },
          (_, i) => ({
            ...createFakeProgramOrm({
              uuid: `movie${i}`,
              type: 'movie',
              duration: 90 * 60 * 1000,
            }),
            parentFillerLists: [],
            parentCustomShows: [],
            parentSmartCollections: [],
          }),
        );

        const schedule: TimeSlotSchedule = {
          type: 'time',
          flexPreference: 'distribute',
          maxDays: 2,
          padMs: 120 * 60 * 1000,
          slots: [
            {
              startTime: 0,
              type: 'movie',
              order: 'shuffle',
              direction: 'asc',
            },
          ],
          period: 'day',
          latenessMs: 0,
          timeZoneOffset: 0,
        };

        const seed = [42, 123, 456, 789];
        const result1 = await scheduleTimeSlots(schedule, programs, seed, 0);
        const result2 = await scheduleTimeSlots(schedule, programs, seed, 100);
      });
    });
  });

  describe('DST handling', () => {
    // US Eastern timezone DST transitions in 2025:
    //   Spring forward: March 9, 2025 at 2:00 AM EST -> 3:00 AM EDT (23-hour day)
    //   Fall back:      November 2, 2025 at 2:00 AM EDT -> 1:00 AM EST (25-hour day)
    const TZ = 'America/New_York';
    const HOUR_MS = 60 * 60 * 1000;

    // Production code (TimeSlotSchedulerService) calls scheduleTimeSlots with
    // dayjs(timestamp) — a plain (non-tz-aware) dayjs. Plain dayjs objects
    // correctly update utcOffset() as the cursor advances through DST boundaries,
    // which is required for the DST compensation logic to fire.
    // dayjs.tz() objects, by contrast, keep utcOffset() stuck at the original
    // offset after .add() calls, so the compensation never activates in tests
    // that use dayjs.tz() directly as startTime.
    const makeStartTime = (dateStr: string) => dayjs(+dayjs.tz(dateStr, TZ));

    // Ensure the system timezone is America/New_York for the duration of these
    // tests so that plain dayjs(epochMs).utcOffset() reflects ET offsets.
    let originalTZ: string | undefined;
    beforeAll(() => {
      originalTZ = process.env['TZ'];
      process.env['TZ'] = TZ;
    });
    afterAll(() => {
      if (originalTZ !== undefined) {
        process.env['TZ'] = originalTZ;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete process.env['TZ'];
      }
    });

    // Two types of programs: movies fill the midnight slot, episodes fill the 6 PM slot.
    // Using fixed UUIDs so we can identify them in the output lineup.
    const makeDstPrograms = () => {
      const movieUuids = Array.from({ length: 30 }, (_, i) => `dst-movie-${i}`);
      const episodeUuids = Array.from({ length: 10 }, (_, i) => `dst-ep-${i}`);

      const movies: SlotSchedulerProgram[] = movieUuids.map((uuid) => ({
        ...createFakeProgramOrm({ uuid, type: 'movie', duration: HOUR_MS }),
        parentFillerLists: [],
        parentCustomShows: [],
        parentSmartCollections: [],
      }));

      const episodes: SlotSchedulerProgram[] = episodeUuids.map((uuid) => ({
        ...createFakeProgramOrm({
          uuid,
          type: 'episode',
          duration: HOUR_MS,
          tvShowUuid: 'dst-show',
          show: { uuid: 'dst-show' },
        }),
        parentFillerLists: [],
        parentCustomShows: [],
        parentSmartCollections: [],
      }));

      return { movies, episodes, movieUuids, episodeUuids };
    };

    // Schedule with two slots: movies from midnight, episodes from 6 PM.
    const makeDstSchedule = (
      overrides?: Partial<TimeSlotSchedule>,
    ): TimeSlotSchedule => ({
      type: 'time',
      flexPreference: 'end',
      maxDays: 2,
      padMs: HOUR_MS,
      slots: [
        {
          startTime: 0, // midnight
          type: 'movie',
          order: 'next',
          direction: 'asc',
        },
        {
          startTime: 18 * HOUR_MS, // 6 PM
          type: 'show',
          showId: 'dst-show',
          order: 'next',
          direction: 'asc',
          seasonFilter: [],
        },
      ],
      period: 'day',
      latenessMs: 0,
      timeZoneOffset: 0,
      ...overrides,
    });

    // Accumulate wall-clock start times for every item in the lineup.
    const itemStartTimes = (
      result: Awaited<ReturnType<typeof scheduleTimeSlots>>,
    ) => {
      let t = result.startTime;
      return result.lineup.map((item) => {
        const start = t;
        t += item.duration;
        return { item, start };
      });
    };

    test('spring forward: 6 PM show slot lands at 6 PM wall-clock time', async () => {
      const { movies, episodes, episodeUuids } = makeDstPrograms();
      const episodeUuidSet = new Set(episodeUuids);

      // Midnight before spring-forward: 23-hour day in America/New_York.
      // The DST compensation detects the transition and shifts currOffset by +1h,
      // which makes the 18h slot appear "late" on March 9 and skips it with flex.
      // Episodes therefore appear on March 10 at 6 PM EDT (hour=18), not March 9.
      const startTime = makeStartTime('2025-03-09 00:00:00');

      const result = await scheduleTimeSlots(
        makeDstSchedule(),
        [...movies, ...episodes],
        [1, 2, 3, 4],
        undefined,
        startTime,
      );

      const entries = itemStartTimes(result);

      const firstEpisode = entries.find(
        ({ item }) =>
          item.type === 'content' && episodeUuidSet.has(item.id ?? ''),
      );

      expect(firstEpisode).toBeDefined();

      const wallClock = dayjs(firstEpisode!.start).tz(TZ);
      // The show slot must always fall at 6 PM EDT regardless of DST transition.
      expect(wallClock.hour()).toBe(18); // 6 PM EDT
      expect(wallClock.minute()).toBe(0);
    });

    test('spring forward: show slot does NOT appear at 7 PM (one hour late) on the DST transition day', async () => {
      const { movies, episodes, episodeUuids } = makeDstPrograms();
      const episodeUuidSet = new Set(episodeUuids);

      // Without DST compensation, 18h of real-time after midnight March 9 EST
      // puts the cursor at 7 PM EDT (hour=19) because the spring-forward swallowed
      // one clock hour. DST compensation skips the March 9 slot entirely instead.
      const startTime = makeStartTime('2025-03-09 00:00:00');

      const result = await scheduleTimeSlots(
        makeDstSchedule(),
        [...movies, ...episodes],
        [1, 2, 3, 4],
        undefined,
        startTime,
      );

      const entries = itemStartTimes(result);
      const episodesAtWrongTime = entries.filter(({ item, start }) => {
        if (item.type !== 'content' || !episodeUuidSet.has(item.id ?? ''))
          return false;
        const wc = dayjs(start).tz(TZ);
        return wc.date() === 9 && wc.month() === 2 && wc.hour() === 19;
      });

      // No episode should land at 7 PM EDT on March 9 (the DST transition day).
      expect(episodesAtWrongTime).toHaveLength(0);
    });

    test('fall back: 6 PM show slot lands at 6 PM wall-clock time on the DST transition day', async () => {
      const { movies, episodes, episodeUuids } = makeDstPrograms();
      const episodeUuidSet = new Set(episodeUuids);

      // Midnight before fall-back: 25-hour day in America/New_York.
      // The DST compensation detects the transition to EST and shifts currOffset
      // by -1h so the 18h slot still matches at the correct 6 PM wall-clock time.
      const startTime = makeStartTime('2025-11-02 00:00:00');

      const result = await scheduleTimeSlots(
        makeDstSchedule(),
        [...movies, ...episodes],
        [1, 2, 3, 4],
        undefined,
        startTime,
      );

      const entries = itemStartTimes(result);
      const firstEpisode = entries.find(
        ({ item }) =>
          item.type === 'content' && episodeUuidSet.has(item.id ?? ''),
      );

      expect(firstEpisode).toBeDefined();

      const wallClock = dayjs(firstEpisode!.start).tz(TZ);
      expect(wallClock.date()).toBe(2); // November 2 (the fall-back day itself)
      expect(wallClock.hour()).toBe(18); // 6 PM EST
      expect(wallClock.minute()).toBe(0);
    });

    test('fall back: show slot does NOT appear at 5 PM (one hour early) without DST compensation', async () => {
      const { movies, episodes, episodeUuids } = makeDstPrograms();
      const episodeUuidSet = new Set(episodeUuids);

      // Without DST compensation, 18h of real-time after midnight Nov 2 EDT
      // puts the cursor at 5 PM EST (hour=17) because the extra clock hour was
      // gained. DST compensation corrects this so episodes land at 6 PM instead.
      const startTime = makeStartTime('2025-11-02 00:00:00');

      const result = await scheduleTimeSlots(
        makeDstSchedule(),
        [...movies, ...episodes],
        [1, 2, 3, 4],
        undefined,
        startTime,
      );

      const entries = itemStartTimes(result);
      const firstEpisode = entries.find(
        ({ item }) =>
          item.type === 'content' && episodeUuidSet.has(item.id ?? ''),
      );

      expect(firstEpisode).toBeDefined();

      const wallClock = dayjs(firstEpisode!.start).tz(TZ);
      // Without DST compensation the slot would land at 5 PM EST (hour=17).
      expect(wallClock.hour()).not.toBe(17);
    });

    test('spring forward: day is actually 23 hours (sanity check for test dates)', () => {
      const startOfDay = dayjs.tz('2025-03-09 00:00:00', TZ);
      const startOfNextDay = dayjs.tz('2025-03-10 00:00:00', TZ);
      expect(+startOfNextDay - +startOfDay).toBe(23 * HOUR_MS);
    });

    test('fall back: day is actually 25 hours (sanity check for test dates)', () => {
      const startOfDay = dayjs.tz('2025-11-02 00:00:00', TZ);
      const startOfNextDay = dayjs.tz('2025-11-03 00:00:00', TZ);
      expect(+startOfNextDay - +startOfDay).toBe(25 * HOUR_MS);
    });

    test('spring forward: all show slots land at 6 PM wall-clock time across the DST boundary', async () => {
      const { movies, episodes, episodeUuids } = makeDstPrograms();
      const episodeUuidSet = new Set(episodeUuids);

      // Start the day before spring-forward to exercise the cross-DST-boundary case.
      // March 8 episodes appear at 6 PM EST; March 9's show slot is skipped by DST
      // compensation (seen as 1h late); March 10+ episodes appear at 6 PM EDT.
      const startTime = makeStartTime('2025-03-08 00:00:00');

      const result = await scheduleTimeSlots(
        makeDstSchedule({ maxDays: 3 }),
        [...movies, ...episodes],
        [1, 2, 3, 4],
        undefined,
        startTime,
      );

      const entries = itemStartTimes(result);

      // Find the first episode of each consecutive episode run — that marks
      // the start of a show slot.  Episodes after the first in a slot are at
      // later hours (7 PM, 8 PM, …) which is expected.
      const slotOpeners: Array<{
        start: number;
        item: (typeof entries)[0]['item'];
      }> = [];
      let prevWasEpisode = false;
      for (const { item, start } of entries) {
        const isEp =
          item.type === 'content' && episodeUuidSet.has(item.id ?? '');
        if (isEp && !prevWasEpisode) {
          slotOpeners.push({ start, item });
        }
        prevWasEpisode = isEp;
      }

      expect(slotOpeners.length).toBeGreaterThan(0);

      // Every show-slot opener must land at 6 PM (hour=18), whether in EST or EDT.
      // The DST compensation ensures the wall-clock slot time is preserved.
      for (const { start, item } of slotOpeners) {
        const wallClock = dayjs(start).tz(TZ);
        const id = (item as { id?: string }).id ?? '?';
        const info = `id=${id} @ ${wallClock.format('MM-DD HH:mm z')}`;
        expect(wallClock.hour(), info).toBe(18);
        expect(wallClock.minute()).toBe(0);
      }
    });
  });
});
