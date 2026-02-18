import { faker } from '@faker-js/faker';
import { tag } from '@tunarr/types';
import dayjs from 'dayjs';
import { now, sum, sumBy } from 'lodash-es';
import { DeepPartial } from 'ts-essentials';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { test as baseTest } from 'vitest';
import { Lineup, LineupItem } from '../db/derived_types/Lineup.ts';
import { StreamLineupItem } from '../db/derived_types/StreamLineup.ts';
import { IChannelDB } from '../db/interfaces/IChannelDB.ts';
import { IFillerListDB } from '../db/interfaces/IFillerListDB.ts';
import { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import { calculateStartTimeOffsets } from '../db/lineupUtil.ts';
import { ProgramPlayHistoryDB } from '../db/ProgramPlayHistoryDB.ts';
import { MediaSourceId } from '../db/schema/base.ts';
import { IStreamLineupCache } from '../interfaces/IStreamLineupCache.ts';
import {
  EmptyFillerPickResult,
  IFillerPicker,
} from '../services/interfaces/IFillerPicker.ts';
import {
  createChannelOrm,
  createFakeProgram,
} from '../testing/fakes/entityCreators.ts';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';
import {
  calculateStreamDuration,
  StreamProgramCalculator,
} from './StreamProgramCalculator.ts';

describe('StreamProgramCalculator', () => {
  baseTest('getCurrentLineupItem simple', async () => {
    const fillerDB = mock<IFillerListDB>();
    const channelDB = mock<IChannelDB>();
    const programDB = mock<IProgramDB>();
    const fillerPicker = mock<IFillerPicker>();
    const channelCache = mock<IStreamLineupCache>();
    const playHistoryDB = mock<ProgramPlayHistoryDB>();

    const startTime = dayjs(new Date(2025, 8, 17, 8));
    const channelId = faker.string.uuid();
    const programId1 = faker.string.uuid();
    const programId2 = faker.string.uuid();

    const lineup: LineupItem[] = [
      {
        type: 'content',
        durationMs: +dayjs.duration({ minutes: 22 }),
        id: programId1,
      },
      {
        type: 'content',
        durationMs: +dayjs.duration({ minutes: 22 }),
        id: programId2,
      },
    ];

    when(programDB.getProgramById(programId1)).thenReturn(
      Promise.resolve(
        createFakeProgram({
          uuid: programId1,
          duration: lineup[0].durationMs,
          mediaSourceId: tag<MediaSourceId>('mediasource-123'),
        }),
      ),
    );

    when(programDB.getProgramById(programId2)).thenReturn(
      Promise.resolve(
        createFakeProgram({
          uuid: programId2,
          duration: lineup[1].durationMs,
          mediaSourceId: tag<MediaSourceId>('mediasource-123'),
        }),
      ),
    );

    const channel = createChannelOrm({
      uuid: channelId,
      number: 1,
      startTime: +startTime.subtract(1, 'hour'),
      duration: sumBy(lineup, ({ durationMs }) => durationMs),
    });

    when(channelDB.getChannelOrm(1)).thenReturn(Promise.resolve(channel));

    when(channelDB.loadLineup(channelId)).thenReturn(
      Promise.resolve({
        version: 1,
        items: lineup,
        startTimeOffsets: calculateStartTimeOffsets(lineup),
        lastUpdated: now(),
      }),
    );

    // Mock play history - program not currently playing
    when(
      playHistoryDB.isProgramCurrentlyPlaying(
        anything(),
        anything(),
        anything(),
      ),
    ).thenReturn(Promise.resolve(false));
    when(playHistoryDB.create(anything())).thenReturn(
      Promise.resolve(undefined),
    );

    const calc = new StreamProgramCalculator(
      LoggerFactory.root,
      instance(fillerDB),
      instance(channelDB),
      instance(channelCache),
      instance(programDB),
      instance(fillerPicker),
      instance(playHistoryDB),
    );

    const out = (
      await calc.getCurrentLineupItem({
        allowSkip: false,
        channelId: 1,
        startTime: +startTime,
      })
    ).get();

    expect(out.lineupItem).toMatchObject<DeepPartial<StreamLineupItem>>({
      streamDuration: +dayjs.duration(6, 'minutes'),
      program: {
        uuid: programId1,
      },
      infiniteLoop: false,
      programBeginMs: +startTime - +dayjs.duration(16, 'minutes'),
      startOffset: +dayjs.duration(16, 'minutes'),
    });

    verify(
      channelCache.recordPlayback(channel.uuid, +startTime, out.lineupItem),
    ).once();
  });

  baseTest('getCurrentLineupItem filler lineup item', async () => {
    const fillerDB = mock<IFillerListDB>();
    const channelDB = mock<IChannelDB>();
    const programDB = mock<IProgramDB>();
    const fillerPicker = mock<IFillerPicker>();
    const channelCache = mock<IStreamLineupCache>();
    const playHistoryDB = mock<ProgramPlayHistoryDB>();

    const startTime = dayjs(new Date(2025, 8, 17, 8));
    const channelId = faker.string.uuid();
    const programId1 = faker.string.uuid();
    const programId2 = faker.string.uuid();
    const fillerListId = faker.string.uuid();

    const lineup: LineupItem[] = [
      {
        type: 'content',
        durationMs: +dayjs.duration({ minutes: 22 }),
        id: programId1,
        fillerListId: fillerListId,
      },
      {
        type: 'content',
        durationMs: +dayjs.duration({ minutes: 22 }),
        id: programId2,
      },
    ];

    when(programDB.getProgramById(programId1)).thenReturn(
      Promise.resolve(
        createFakeProgram({
          uuid: programId1,
          duration: lineup[0].durationMs,
          mediaSourceId: tag<MediaSourceId>('mediasource-123'),
        }),
      ),
    );

    when(programDB.getProgramById(programId2)).thenReturn(
      Promise.resolve(
        createFakeProgram({
          uuid: programId2,
          duration: lineup[1].durationMs,
          mediaSourceId: tag<MediaSourceId>('mediasource-123'),
        }),
      ),
    );

    const channel = createChannelOrm({
      uuid: channelId,
      number: 1,
      startTime: +startTime.subtract(1, 'hour'),
      duration: sumBy(lineup, ({ durationMs }) => durationMs),
    });

    when(channelDB.getChannelOrm(1)).thenReturn(Promise.resolve(channel));

    when(channelDB.loadLineup(channelId)).thenReturn(
      Promise.resolve({
        version: 1,
        items: lineup,
        startTimeOffsets: calculateStartTimeOffsets(lineup),
        lastUpdated: now(),
      }),
    );

    // Mock play history - program not currently playing
    when(
      playHistoryDB.isProgramCurrentlyPlaying(
        anything(),
        anything(),
        anything(),
      ),
    ).thenReturn(Promise.resolve(false));
    when(playHistoryDB.create(anything())).thenReturn(
      Promise.resolve(undefined),
    );

    const calc = new StreamProgramCalculator(
      LoggerFactory.root,
      instance(fillerDB),
      instance(channelDB),
      instance(channelCache),
      instance(programDB),
      instance(fillerPicker),
      instance(playHistoryDB),
    );

    const out = (
      await calc.getCurrentLineupItem({
        allowSkip: false,
        channelId: 1,
        startTime: +startTime,
      })
    ).get();

    expect(out.lineupItem).toMatchObject<DeepPartial<StreamLineupItem>>({
      streamDuration: +dayjs.duration(6, 'minutes'),
      program: {
        uuid: programId1,
      },
      infiniteLoop: false,
      programBeginMs: +startTime - +dayjs.duration(16, 'minutes'),
      startOffset: +dayjs.duration(16, 'minutes'),
      fillerListId: fillerListId,
      type: 'commercial',
    });

    verify(
      channelCache.recordPlayback(channel.uuid, +startTime, out.lineupItem),
    ).once();
  });

  describe('skipCredits', () => {
    const setupSkipCreditsTest = (opts: {
      skipCredits: boolean;
      outroStartTimeMs: number | null;
      programDurationMs: number;
      channelStartOffset: dayjs.Dayjs;
    }) => {
      const fillerDB = mock<IFillerListDB>();
      const channelDB = mock<IChannelDB>();
      const programDB = mock<IProgramDB>();
      const fillerPicker = mock<IFillerPicker>();
      const channelCache = mock<IStreamLineupCache>();

      const startTime = dayjs(new Date(2025, 8, 17, 8));
      const channelId = faker.string.uuid();
      const programId = faker.string.uuid();
      const versionId = faker.string.uuid();

      const lineup: LineupItem[] = [
        {
          type: 'content',
          durationMs: opts.programDurationMs,
          id: programId,
        },
      ];

      const chapters =
        opts.outroStartTimeMs !== null
          ? [
              {
                uuid: faker.string.uuid(),
                index: 0,
                startTime: opts.outroStartTimeMs,
                endTime: opts.programDurationMs,
                title: null,
                chapterType: 'outro' as const,
                programVersionId: versionId,
              },
            ]
          : [];

      when(programDB.getProgramById(programId)).thenReturn(
        Promise.resolve(
          createFakeProgram({
            uuid: programId,
            duration: opts.programDurationMs,
            mediaSourceId: tag<MediaSourceId>('mediasource-123'),
            versions: [
              {
                uuid: versionId,
                createdAt: new Date(),
                updatedAt: new Date(),
                duration: opts.programDurationMs,
                sampleAspectRatio: '1:1',
                displayAspectRatio: '1.78',
                frameRate: '23.98',
                scanKind: 'progressive',
                width: 1920,
                height: 1080,
                programId: programId,
                chapters,
              },
            ],
          }),
        ),
      );

      const channel = createChannelOrm({
        uuid: channelId,
        number: 1,
        startTime: +opts.channelStartOffset,
        duration: opts.programDurationMs,
        skipCredits: opts.skipCredits,
      });

      when(channelDB.getChannelOrm(1)).thenReturn(Promise.resolve(channel));
      when(channelDB.loadLineup(channelId)).thenReturn(
        Promise.resolve({
          version: 1,
          items: lineup,
          startTimeOffsets: calculateStartTimeOffsets(lineup),
          lastUpdated: now(),
        }),
      );

      // Mock filler-related calls for offline item handling
      when(fillerDB.getFillersFromChannel(channelId)).thenReturn(
        Promise.resolve([]),
      );
      when(channelDB.getChannelFallbackPrograms(channelId)).thenReturn(
        Promise.resolve([]),
      );
      when(
        fillerPicker.pickFiller(anything(), anything(), anything()),
      ).thenReturn(EmptyFillerPickResult);

      const calc = new StreamProgramCalculator(
        LoggerFactory.root,
        instance(fillerDB),
        instance(channelDB),
        instance(channelCache),
        instance(programDB),
        instance(fillerPicker),
      );

      return { calc, startTime, channelCache, channel };
    };

    baseTest('caps streamDuration at outro start time', async () => {
      const programDuration = +dayjs.duration({ minutes: 30 });
      const outroStart = +dayjs.duration({ minutes: 25 });
      const channelStartTime = dayjs(new Date(2025, 8, 17, 8)).subtract(
        10,
        'minutes',
      );

      const { calc, startTime } = setupSkipCreditsTest({
        skipCredits: true,
        outroStartTimeMs: outroStart,
        programDurationMs: programDuration,
        channelStartOffset: channelStartTime,
      });

      // 10 minutes into a 30-minute program, credits at 25 min
      // Without skip: streamDuration = 30 - 10 = 20 min
      // With skip: streamDuration = min(20, 25 - 10) = 15 min
      const out = (
        await calc.getCurrentLineupItem({
          allowSkip: false,
          channelId: 1,
          startTime: +startTime,
        })
      ).get();

      expect(out.lineupItem.streamDuration).toBe(
        outroStart - +dayjs.duration({ minutes: 10 }),
      );
    });

    baseTest('mid-credits tune-in returns offline item', async () => {
      const programDuration = +dayjs.duration({ minutes: 30 });
      const outroStart = +dayjs.duration({ minutes: 5 });
      const channelStartTime = dayjs(new Date(2025, 8, 17, 8)).subtract(
        10,
        'minutes',
      );

      const { calc, startTime } = setupSkipCreditsTest({
        skipCredits: true,
        outroStartTimeMs: outroStart,
        programDurationMs: programDuration,
        channelStartOffset: channelStartTime,
      });

      // 10 minutes into a 30-minute program, credits at 5 min
      // timeElapsed (10 min) > outroStart (5 min) => during credits
      // Should return offline item, capped at 10 min max by createLineupItem
      const out = (
        await calc.getCurrentLineupItem({
          allowSkip: false,
          channelId: 1,
          startTime: +startTime,
        })
      ).get();

      expect(out.lineupItem.type).toBe('offline');
      // Offline screen caps at 10 minutes (see createLineupItem)
      expect(out.lineupItem.streamDuration).toBe(
        +dayjs.duration({ minutes: 10 }),
      );
    });

    baseTest('no outro chapter has no effect on streamDuration', async () => {
      const programDuration = +dayjs.duration({ minutes: 30 });
      const channelStartTime = dayjs(new Date(2025, 8, 17, 8)).subtract(
        10,
        'minutes',
      );

      const { calc, startTime } = setupSkipCreditsTest({
        skipCredits: true,
        outroStartTimeMs: null,
        programDurationMs: programDuration,
        channelStartOffset: channelStartTime,
      });

      // No outro chapter — full remaining duration should apply
      const out = (
        await calc.getCurrentLineupItem({
          allowSkip: false,
          channelId: 1,
          startTime: +startTime,
        })
      ).get();

      expect(out.lineupItem.streamDuration).toBe(
        programDuration - +dayjs.duration({ minutes: 10 }),
      );
    });

    baseTest('skipCredits disabled ignores outro chapters', async () => {
      const programDuration = +dayjs.duration({ minutes: 30 });
      const outroStart = +dayjs.duration({ minutes: 25 });
      const channelStartTime = dayjs(new Date(2025, 8, 17, 8)).subtract(
        10,
        'minutes',
      );

      const { calc, startTime } = setupSkipCreditsTest({
        skipCredits: false,
        outroStartTimeMs: outroStart,
        programDurationMs: programDuration,
        channelStartOffset: channelStartTime,
      });

      // skipCredits is false — outro chapter should be ignored
      // streamDuration = 30 - 10 = 20 min (full remaining)
      const out = (
        await calc.getCurrentLineupItem({
          allowSkip: false,
          channelId: 1,
          startTime: +startTime,
        })
      ).get();

      expect(out.lineupItem.streamDuration).toBe(
        programDuration - +dayjs.duration({ minutes: 10 }),
      );
    });
  });

  baseTest('getCurrentLineupItem loop filler lineup item', async () => {
    const fillerDB = mock<IFillerListDB>();
    const channelDB = mock<IChannelDB>();
    const programDB = mock<IProgramDB>();
    const fillerPicker = mock<IFillerPicker>();
    const channelCache = mock<IStreamLineupCache>();
    const playHistoryDB = mock<ProgramPlayHistoryDB>();

    const startTime = dayjs(new Date(2025, 8, 17, 8));
    const channelId = faker.string.uuid();
    const programId1 = faker.string.uuid();
    const programId2 = faker.string.uuid();
    const fillerListId = faker.string.uuid();

    const lineup: LineupItem[] = [
      {
        type: 'content',
        durationMs: +dayjs.duration({ minutes: 22 }),
        id: programId1,
        fillerListId: fillerListId,
      },
      {
        type: 'content',
        durationMs: +dayjs.duration({ minutes: 22 }),
        id: programId2,
      },
    ];

    when(programDB.getProgramById(programId1)).thenReturn(
      Promise.resolve(
        createFakeProgram({
          uuid: programId1,
          duration: +dayjs.duration({ minutes: 2 }),
          mediaSourceId: tag<MediaSourceId>('mediasource-123'),
        }),
      ),
    );

    when(programDB.getProgramById(programId2)).thenReturn(
      Promise.resolve(
        createFakeProgram({
          uuid: programId2,
          duration: lineup[1].durationMs,
          mediaSourceId: tag<MediaSourceId>('mediasource-123'),
        }),
      ),
    );

    const channel = createChannelOrm({
      uuid: channelId,
      number: 1,
      startTime: +startTime.subtract(1, 'hour'),
      duration: sumBy(lineup, ({ durationMs }) => durationMs),
    });

    when(channelDB.getChannelOrm(1)).thenReturn(Promise.resolve(channel));

    when(channelDB.loadLineup(channelId)).thenReturn(
      Promise.resolve({
        version: 1,
        items: lineup,
        startTimeOffsets: calculateStartTimeOffsets(lineup),
        lastUpdated: now(),
      }),
    );

    // Mock play history - program not currently playing
    when(
      playHistoryDB.isProgramCurrentlyPlaying(
        anything(),
        anything(),
        anything(),
      ),
    ).thenReturn(Promise.resolve(false));
    when(playHistoryDB.create(anything())).thenReturn(
      Promise.resolve(undefined),
    );

    const calc = new StreamProgramCalculator(
      LoggerFactory.root,
      instance(fillerDB),
      instance(channelDB),
      instance(channelCache),
      instance(programDB),
      instance(fillerPicker),
      instance(playHistoryDB),
    );

    const out = (
      await calc.getCurrentLineupItem({
        allowSkip: false,
        channelId: 1,
        startTime: +startTime,
      })
    ).get();

    expect(out.lineupItem).toMatchObject<DeepPartial<StreamLineupItem>>({
      streamDuration: +dayjs.duration(6, 'minutes'),
      program: { uuid: programId1 },
      infiniteLoop: true,
      programBeginMs: +startTime - +dayjs.duration(16, 'minutes'),
      startOffset: +dayjs.duration(16, 'minutes'),
      fillerListId: fillerListId,
      type: 'commercial',
      duration: +dayjs.duration(22, 'minutes'),
    });

    verify(
      channelCache.recordPlayback(channel.uuid, +startTime, out.lineupItem),
    ).once();
  });

  baseTest('records play history for new playback', async () => {
    const fillerDB = mock<IFillerListDB>();
    const channelDB = mock<IChannelDB>();
    const programDB = mock<IProgramDB>();
    const fillerPicker = mock<IFillerPicker>();
    const channelCache = mock<IStreamLineupCache>();
    const playHistoryDB = mock<ProgramPlayHistoryDB>();

    const startTime = dayjs(new Date(2025, 8, 17, 8));
    const channelId = faker.string.uuid();
    const programId1 = faker.string.uuid();
    const programId2 = faker.string.uuid();

    const lineup: LineupItem[] = [
      {
        type: 'content',
        durationMs: +dayjs.duration({ minutes: 22 }),
        id: programId1,
      },
      {
        type: 'content',
        durationMs: +dayjs.duration({ minutes: 22 }),
        id: programId2,
      },
    ];

    when(programDB.getProgramById(programId1)).thenReturn(
      Promise.resolve(
        createFakeProgram({
          uuid: programId1,
          duration: lineup[0].durationMs,
          mediaSourceId: tag<MediaSourceId>('mediasource-123'),
        }),
      ),
    );

    when(programDB.getProgramById(programId2)).thenReturn(
      Promise.resolve(
        createFakeProgram({
          uuid: programId2,
          duration: lineup[1].durationMs,
          mediaSourceId: tag<MediaSourceId>('mediasource-123'),
        }),
      ),
    );

    const channel = createChannelOrm({
      uuid: channelId,
      number: 1,
      startTime: +startTime.subtract(1, 'hour'),
      duration: sumBy(lineup, ({ durationMs }) => durationMs),
    });

    when(channelDB.getChannelOrm(1)).thenReturn(Promise.resolve(channel));

    when(channelDB.loadLineup(channelId)).thenReturn(
      Promise.resolve({
        version: 1,
        items: lineup,
        startTimeOffsets: calculateStartTimeOffsets(lineup),
        lastUpdated: now(),
      }),
    );

    // Mock play history - program NOT currently playing
    when(
      playHistoryDB.isProgramCurrentlyPlaying(
        anything(),
        anything(),
        anything(),
      ),
    ).thenReturn(Promise.resolve(false));
    when(playHistoryDB.create(anything())).thenReturn(
      Promise.resolve(undefined),
    );

    const calc = new StreamProgramCalculator(
      LoggerFactory.root,
      instance(fillerDB),
      instance(channelDB),
      instance(channelCache),
      instance(programDB),
      instance(fillerPicker),
      instance(playHistoryDB),
    );

    await calc.getCurrentLineupItem({
      allowSkip: false,
      channelId: 1,
      startTime: +startTime,
    });

    // Wait for async play history recording
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify play history was checked
    verify(
      playHistoryDB.isProgramCurrentlyPlaying(
        channelId,
        programId1,
        +startTime,
      ),
    ).once();

    // Verify play history was created since program was not currently playing
    verify(playHistoryDB.create(anything())).once();
  });

  baseTest(
    'does not record duplicate play history when program is already playing',
    async () => {
      const fillerDB = mock<IFillerListDB>();
      const channelDB = mock<IChannelDB>();
      const programDB = mock<IProgramDB>();
      const fillerPicker = mock<IFillerPicker>();
      const channelCache = mock<IStreamLineupCache>();
      const playHistoryDB = mock<ProgramPlayHistoryDB>();

      const startTime = dayjs(new Date(2025, 8, 17, 8));
      const channelId = faker.string.uuid();
      const programId1 = faker.string.uuid();
      const programId2 = faker.string.uuid();

      const lineup: LineupItem[] = [
        {
          type: 'content',
          durationMs: +dayjs.duration({ minutes: 22 }),
          id: programId1,
        },
        {
          type: 'content',
          durationMs: +dayjs.duration({ minutes: 22 }),
          id: programId2,
        },
      ];

      when(programDB.getProgramById(programId1)).thenReturn(
        Promise.resolve(
          createFakeProgram({
            uuid: programId1,
            duration: lineup[0].durationMs,
            mediaSourceId: tag<MediaSourceId>('mediasource-123'),
          }),
        ),
      );

      when(programDB.getProgramById(programId2)).thenReturn(
        Promise.resolve(
          createFakeProgram({
            uuid: programId2,
            duration: lineup[1].durationMs,
            mediaSourceId: tag<MediaSourceId>('mediasource-123'),
          }),
        ),
      );

      const channel = createChannelOrm({
        uuid: channelId,
        number: 1,
        startTime: +startTime.subtract(1, 'hour'),
        duration: sumBy(lineup, ({ durationMs }) => durationMs),
      });

      when(channelDB.getChannelOrm(1)).thenReturn(Promise.resolve(channel));

      when(channelDB.loadLineup(channelId)).thenReturn(
        Promise.resolve({
          version: 1,
          items: lineup,
          startTimeOffsets: calculateStartTimeOffsets(lineup),
          lastUpdated: now(),
        }),
      );

      // Mock play history - program IS currently playing (simulates another client already connected)
      when(
        playHistoryDB.isProgramCurrentlyPlaying(
          anything(),
          anything(),
          anything(),
        ),
      ).thenReturn(Promise.resolve(true));

      const calc = new StreamProgramCalculator(
        LoggerFactory.root,
        instance(fillerDB),
        instance(channelDB),
        instance(channelCache),
        instance(programDB),
        instance(fillerPicker),
        instance(playHistoryDB),
      );

      await calc.getCurrentLineupItem({
        allowSkip: false,
        channelId: 1,
        startTime: +startTime,
      });

      // Wait for async play history recording
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify play history was checked
      verify(
        playHistoryDB.isProgramCurrentlyPlaying(
          channelId,
          programId1,
          +startTime,
        ),
      ).once();

      // Verify play history was NOT created since program was already playing
      verify(playHistoryDB.create(anything())).never();
    },
  );

  describe('calculateStreamDuration', () => {
    test('first channel cycle', () => {
      const lineupItems: LineupItem[] = [
        { type: 'content', id: '1', durationMs: 2000 },
        { type: 'content', id: '2', durationMs: 3000 },
        { type: 'content', id: '3', durationMs: 4000 },
      ];
      const offsets = calculateStartTimeOffsets(lineupItems);
      const lineup: Lineup = {
        version: 1,
        items: lineupItems,
        startTimeOffsets: offsets,
        lastUpdated: now(),
      };
      const duration = sum(lineupItems.map((i) => i.durationMs));
      // we are one "tick" into the 2nd show. there are 2 ticks
      // remaining
      // |--|---|----|
      //     ^
      const { streamDuration } = calculateStreamDuration(
        3000,
        0,
        duration,
        lineup,
        0,
      );
      expect(streamDuration).toEqual(2000);
    });

    test('next channel cycle', () => {
      const lineupItems: LineupItem[] = [
        { type: 'content', id: '1', durationMs: 2000 },
        { type: 'content', id: '2', durationMs: 3000 },
        { type: 'content', id: '3', durationMs: 4000 },
      ];
      const offsets = calculateStartTimeOffsets(lineupItems);
      const lineup: Lineup = {
        version: 1,
        items: lineupItems,
        startTimeOffsets: offsets,
        lastUpdated: now(),
      };
      const duration = sum(lineupItems.map((i) => i.durationMs));
      // we are one "tick" into the 2nd show. there are 2 ticks
      // remaining. the channel has cycled once
      // |--|---|----|
      //     ^
      const { streamDuration } = calculateStreamDuration(
        duration + 3000,
        0,
        duration,
        lineup,
        0,
      );
      expect(streamDuration).toEqual(2000);
    });

    test('loop appropriately on last item', () => {
      const lineupItems: LineupItem[] = [
        { type: 'content', id: '1', durationMs: 2000 },
        { type: 'content', id: '2', durationMs: 3000 },
        { type: 'content', id: '3', durationMs: 4000 },
      ];
      const offsets = calculateStartTimeOffsets(lineupItems);
      const lineup: Lineup = {
        version: 1,
        items: lineupItems,
        startTimeOffsets: offsets,
        lastUpdated: now(),
      };
      const duration = sum(lineupItems.map((i) => i.durationMs));
      // we are one "tick" into the 3rd show. there are 3 ticks
      // remaining in the current program.
      // |--|---|----|
      //         ^
      // The next program (after current finishes) is the first program in the channel
      const { streamDuration } = calculateStreamDuration(
        6_000,
        0,
        duration,
        lineup,
        0,
      );
      expect(streamDuration).toEqual(3000);
    });
  });
});
