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
import { IFillerPicker } from '../services/interfaces/IFillerPicker.ts';
import {
  createChannelOrm,
  createFakeProgram,
} from '../testing/fakes/entityCreators.ts';
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
      instance(fillerDB),
      instance(channelDB),
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

    // Wait for async play history recording
    await new Promise((resolve) => setTimeout(resolve, 10));

    verify(
      playHistoryDB.isProgramCurrentlyPlaying(
        channelId,
        programId1,
        +startTime,
      ),
    ).once();
    verify(playHistoryDB.create(anything())).once();
  });

  baseTest('getCurrentLineupItem filler lineup item', async () => {
    const fillerDB = mock<IFillerListDB>();
    const channelDB = mock<IChannelDB>();
    const programDB = mock<IProgramDB>();
    const fillerPicker = mock<IFillerPicker>();
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
      instance(fillerDB),
      instance(channelDB),
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

    // Wait for async play history recording
    await new Promise((resolve) => setTimeout(resolve, 10));

    verify(
      playHistoryDB.isProgramCurrentlyPlaying(
        channelId,
        programId1,
        +startTime,
      ),
    ).once();
    verify(playHistoryDB.create(anything())).once();
  });

  baseTest('getCurrentLineupItem loop filler lineup item', async () => {
    const fillerDB = mock<IFillerListDB>();
    const channelDB = mock<IChannelDB>();
    const programDB = mock<IProgramDB>();
    const fillerPicker = mock<IFillerPicker>();
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
      instance(fillerDB),
      instance(channelDB),
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

    // Wait for async play history recording
    await new Promise((resolve) => setTimeout(resolve, 10));

    verify(
      playHistoryDB.isProgramCurrentlyPlaying(
        channelId,
        programId1,
        +startTime,
      ),
    ).once();
    verify(playHistoryDB.create(anything())).once();
  });

  baseTest('records play history for new playback', async () => {
    const fillerDB = mock<IFillerListDB>();
    const channelDB = mock<IChannelDB>();
    const programDB = mock<IProgramDB>();
    const fillerPicker = mock<IFillerPicker>();
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
      instance(fillerDB),
      instance(channelDB),
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
        instance(fillerDB),
        instance(channelDB),
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

  baseTest(
    'mid-roll break: startOffset should not double-count startOffsetMs',
    async () => {
      const fillerDB = mock<IFillerListDB>();
      const channelDB = mock<IChannelDB>();
      const programDB = mock<IProgramDB>();
      const fillerPicker = mock<IFillerPicker>();
      const playHistoryDB = mock<ProgramPlayHistoryDB>();

      const channelId = faker.string.uuid();
      const programId = faker.string.uuid();

      // Simulate a 22-min episode split by mid-roll into:
      //   segment 1: 8 min of content (startOffsetMs=0)
      //   flex break: 3 min
      //   segment 2: 14 min of content (startOffsetMs=8min)
      const seg1Duration = +dayjs.duration({ minutes: 8 });
      const breakDuration = +dayjs.duration({ minutes: 3 });
      const seg2Duration = +dayjs.duration({ minutes: 14 });
      const seg2StartOffset = seg1Duration; // 8 min into the source media

      const lineup: LineupItem[] = [
        {
          type: 'content',
          durationMs: seg1Duration,
          id: programId,
          startOffsetMs: 0,
        },
        {
          type: 'offline',
          durationMs: breakDuration,
        },
        {
          type: 'content',
          durationMs: seg2Duration,
          id: programId,
          startOffsetMs: seg2StartOffset,
        },
      ];

      const totalDuration = sumBy(lineup, (i) => i.durationMs);

      // Channel started exactly at totalDuration ago, so we're at the
      // start of the first cycle.
      const channelStartTime = 0;
      // "now" is 2 minutes into segment 2:
      // seg1(8min) + break(3min) + 2min = 13min
      const twoMinutes = +dayjs.duration({ minutes: 2 });
      const currentTime = seg1Duration + breakDuration + twoMinutes;

      when(programDB.getProgramById(programId)).thenReturn(
        Promise.resolve(
          createFakeProgram({
            uuid: programId,
            duration: seg1Duration + seg2Duration, // full episode duration
            mediaSourceId: tag<MediaSourceId>('mediasource-123'),
          }),
        ),
      );

      const channel = createChannelOrm({
        uuid: channelId,
        number: 1,
        startTime: channelStartTime,
        duration: totalDuration,
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
        instance(fillerDB),
        instance(channelDB),
        instance(programDB),
        instance(fillerPicker),
        instance(playHistoryDB),
      );

      const out = (
        await calc.getCurrentLineupItem({
          allowSkip: false,
          channelId: 1,
          startTime: currentTime,
        })
      ).get();

      // We are 2 minutes into segment 2 which starts at 8 min in the source.
      // The correct seek position is 8min + 2min = 10min.
      // NOT 8min + 2min + 8min = 18min (double-counted).
      const expectedStartOffset = seg2StartOffset + twoMinutes;
      expect(out.lineupItem).toMatchObject<DeepPartial<StreamLineupItem>>({
        type: 'program',
        program: { uuid: programId },
        startOffset: expectedStartOffset,
        streamDuration: seg2Duration - twoMinutes,
      });
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
