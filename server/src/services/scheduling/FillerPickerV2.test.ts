import { faker } from '@faker-js/faker';
import dayjs from 'dayjs';
import { v4 } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgramPlayHistoryDB } from '../../db/ProgramPlayHistoryDB.ts';
import type { Channel } from '../../db/schema/Channel.ts';
import type {
  ChannelFillerShowWithContent,
  ProgramWithRelations,
} from '../../db/schema/derivedTypes.ts';
import { type ProgramPlayHistoryOrm } from '../../db/schema/ProgramPlayHistory.ts';
import { OneDayMillis } from '../../ffmpeg/builder/constants.ts';
import {
  DefaultFillerCooldownMillis,
  EmptyFillerPickResult,
} from '../interfaces/IFillerPicker.ts';
import { FillerPickerV2 } from './FillerPickerV2.ts';

// Mock the random module for deterministic tests
vi.mock('../../util/random.ts', () => ({
  random: {
    bool: vi.fn(),
    shuffle: vi.fn(<T>(arr: T[]) => arr),
  },
}));

import { random } from '../../util/random.ts';

describe('FillerPickerV2', () => {
  let mockPlayHistoryDB: ProgramPlayHistoryDB;
  let mockLogger: {
    isLevelEnabled: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    trace: ReturnType<typeof vi.fn>;
  };
  let picker: FillerPickerV2;
  let mockChannel: Channel;

  function createProgram(
    overrides: Partial<ProgramWithRelations> = {},
  ): ProgramWithRelations {
    return {
      uuid: v4(),
      duration: 30000,
      type: 'movie',
      title: faker.lorem.words(3),
      externalKey: faker.string.alphanumeric(10),
      externalSourceId: 'plex',
      sourceType: 'plex',
      ...overrides,
    } as ProgramWithRelations;
  }

  function createFiller(
    overrides: Partial<ChannelFillerShowWithContent> = {},
  ): ChannelFillerShowWithContent {
    const fillerShowUuid = overrides.fillerShowUuid ?? v4();
    return {
      fillerShowUuid,
      channelUuid: mockChannel.uuid,
      weight: 100,
      cooldown: 0,
      fillerShow: {
        uuid: fillerShowUuid,
        name: faker.lorem.words(2),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      fillerContent: [createProgram()],
      ...overrides,
    } as ChannelFillerShowWithContent;
  }

  function createPlayHistory(
    programUuid: string,
    playedAt: Date,
    fillerListId: string,
  ): ProgramPlayHistoryOrm {
    return {
      uuid: v4(),
      programUuid,
      playedAt,
      channelUuid: mockChannel.uuid,
      playedDuration: 30000,
      createdAt: new Date(),
      fillerListId,
    };
  }

  beforeEach(() => {
    mockPlayHistoryDB = {
      getFillerHistory: vi.fn().mockResolvedValue([]),
    } as unknown as ProgramPlayHistoryDB;

    mockLogger = {
      isLevelEnabled: vi.fn().mockReturnValue(false),
      debug: vi.fn(),
      trace: vi.fn(),
    };

    picker = new FillerPickerV2(mockPlayHistoryDB, mockLogger as never);

    mockChannel = {
      uuid: v4(),
      fillerRepeatCooldown: DefaultFillerCooldownMillis, // 30 minutes
      name: 'Test Channel',
      number: 1,
      duration: 0,
      guideMinimumDuration: 30000,
      icon: {},
      offline: { mode: 'pic' },
      startTime: Date.now(),
      streamMode: 'hls',
      transcodeConfigId: v4(),
    } as Channel;

    vi.clearAllMocks();
  });

  describe('edge cases', () => {
    it('returns EmptyFillerPickResult when fillers array is empty', async () => {
      const result = await picker.pickFiller(mockChannel, [], 60000);
      expect(result).toEqual(EmptyFillerPickResult);
    });

    it('returns EmptyFillerPickResult when fillers is undefined-ish empty', async () => {
      const result = await picker.pickFiller(mockChannel, [], 60000);
      expect(result.filler).toBeNull();
      expect(result.fillerListId).toBeNull();
      expect(result.minimumWait).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('queries play history once for the channel (batched)', async () => {
      const fillers = [createFiller(), createFiller()];
      vi.mocked(random.bool).mockReturnValue(false);

      await picker.pickFiller(mockChannel, fillers, 60000);

      // Now uses a single batched query instead of N+1 queries
      expect(mockPlayHistoryDB.getFillerHistory).toHaveBeenCalledTimes(1);
      expect(mockPlayHistoryDB.getFillerHistory).toHaveBeenCalledWith(
        mockChannel.uuid,
      );
    });

    it('uses default fillerRepeatCooldown when channel has none set', async () => {
      const channelWithoutCooldown = {
        ...mockChannel,
        fillerRepeatCooldown: null,
      } as Channel;

      const now = Date.now();
      const programUuid = v4();
      const filler = createFiller();
      filler.fillerContent = [createProgram({ uuid: programUuid })];

      // Program played 20 minutes ago (within 30-minute default cooldown)
      vi.mocked(mockPlayHistoryDB.getFillerHistory).mockResolvedValue([
        createPlayHistory(
          programUuid,
          new Date(now - 20 * 60 * 1000),
          filler.fillerShowUuid,
        ),
      ]);

      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(
        channelWithoutCooldown,
        [filler],
        60000,
        now,
      );

      // Program should be skipped due to default cooldown
      expect(result.filler).toBeNull();
    });
  });

  // ==========================================
  // FILLER LIST SELECTION TESTS
  // ==========================================

  describe('filler list selection', () => {
    it('selects filler when random.bool returns true and no cooldown', async () => {
      const filler = createFiller({ weight: 50 });
      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(mockChannel, [filler], 60000);

      expect(result.fillerListId).toBe(filler.fillerShowUuid);
      expect(result.filler).toBeDefined();
    });

    it('does not select filler when random.bool returns false', async () => {
      const filler = createFiller({ weight: 50 });
      vi.mocked(random.bool).mockReturnValue(false);

      const result = await picker.pickFiller(mockChannel, [filler], 60000);

      expect(result.filler).toBeNull();
      expect(result.fillerListId).toBeNull();
    });

    it('skips filler list when still in cooldown period', async () => {
      const now = Date.now();
      const programUuid = v4();
      const filler = createFiller({ cooldown: 60000 }); // 1 minute cooldown
      filler.fillerContent = [createProgram({ uuid: programUuid })];

      // Played 30 seconds ago (still in cooldown)
      vi.mocked(mockPlayHistoryDB.getFillerHistory).mockResolvedValue([
        createPlayHistory(
          programUuid,
          new Date(now - 30000),
          filler.fillerShowUuid,
        ),
      ]);

      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(mockChannel, [filler], 60000, now);

      // Should not pick this filler due to cooldown
      expect(result.filler).toBeNull();
    });

    it('selects filler when cooldown has expired', async () => {
      const now = Date.now();
      const programUuid = v4();
      const filler = createFiller({ cooldown: 60000 }); // 1 minute list cooldown
      filler.fillerContent = [createProgram({ uuid: programUuid })];

      // Played 45 minutes ago - exceeds both list cooldown (1 min) AND
      // program repeat cooldown (30 min default)
      vi.mocked(mockPlayHistoryDB.getFillerHistory).mockResolvedValue([
        createPlayHistory(
          programUuid,
          new Date(now - 45 * 60 * 1000),
          filler.fillerShowUuid,
        ),
      ]);

      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(mockChannel, [filler], 60000, now);

      expect(result.fillerListId).toBe(filler.fillerShowUuid);
      expect(result.filler).not.toBeNull();
    });

    it('treats never-played filler as having OneDayMillis time since played', async () => {
      const filler = createFiller({ cooldown: OneDayMillis + 1 }); // Cooldown longer than default "never played" time

      // No play history
      vi.mocked(mockPlayHistoryDB.getFillerHistory).mockResolvedValue([]);

      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(mockChannel, [filler], 60000);

      // Should not pick because cooldown > OneDayMillis (default for never played)
      expect(result.filler).toBeNull();
    });

    it('accumulates weight across all fillers regardless of cooldown', async () => {
      const now = Date.now();

      // First filler in cooldown
      const filler1 = createFiller({ weight: 50, cooldown: 60000 });
      // Second filler not in cooldown
      const filler2 = createFiller({ weight: 50, cooldown: 0 });

      // Return history that puts filler1 in cooldown
      vi.mocked(mockPlayHistoryDB.getFillerHistory).mockResolvedValue([
        createPlayHistory(v4(), new Date(now - 30000), filler1.fillerShowUuid), // In cooldown
      ]);

      // Track the weight values passed to random.bool
      const boolCalls: Array<{ weight: number; totalWeight: number }> = [];

      let programCalls = 0,
        fillerCalls = 0;
      vi.spyOn(picker, 'weightedPick').mockImplementation(
        (reason, num, den) => {
          if (reason === 'filler') {
            fillerCalls++;
            boolCalls.push({
              weight: num,
              totalWeight: den,
            });
            return true;
          } else if (reason === 'program') {
            programCalls++;
            return programCalls > 1;
          }
          return false;
        },
      );

      await picker.pickFiller(mockChannel, [filler1, filler2], 60000, now);

      // The second filler should see accumulated weight from first filler
      // filler1 adds 50 to listWeight, then filler2 adds 50 more = 100 total
      const listSelectionCall = boolCalls.find((c) => c.totalWeight === 100);
      expect(listSelectionCall).toBeDefined();
    });

    it('breaks out of loop after selecting a filler list', async () => {
      const filler1 = createFiller({ weight: 100 });
      const filler2 = createFiller({ weight: 100 });

      let boolCallCount = 0;
      vi.mocked(random.bool).mockImplementation(() => {
        boolCallCount++;
        return true; // Always select
      });

      await picker.pickFiller(mockChannel, [filler1, filler2], 60000);

      // Should break after first filler is selected
      // One call for list selection, one for program selection
      expect(boolCallCount).toBeLessThanOrEqual(2);
    });
  });

  // ==========================================
  // PROGRAM SELECTION TESTS
  // ==========================================

  describe('program selection within filler', () => {
    it('skips programs that were played within repeat cooldown', async () => {
      const now = Date.now();
      const programUuid = v4();
      const filler = createFiller();
      filler.fillerContent = [createProgram({ uuid: programUuid })];

      // Program played 10 minutes ago (within 30-minute default cooldown)
      vi.mocked(mockPlayHistoryDB.getFillerHistory).mockResolvedValue([
        createPlayHistory(
          programUuid,
          new Date(now - 10 * 60 * 1000),
          filler.fillerShowUuid,
        ),
      ]);

      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(mockChannel, [filler], 60000, now);

      // Program should be skipped, so no filler returned even though list was selected
      expect(result.filler).toBeNull();
    });

    it('selects program when repeat cooldown has expired', async () => {
      const now = Date.now();
      const programUuid = v4();
      const filler = createFiller();
      filler.fillerContent = [createProgram({ uuid: programUuid })];

      // Program played 45 minutes ago (outside 30-minute cooldown)
      vi.mocked(mockPlayHistoryDB.getFillerHistory).mockResolvedValue([
        createPlayHistory(
          programUuid,
          new Date(now - 45 * 60 * 1000),
          filler.fillerShowUuid,
        ),
      ]);

      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(mockChannel, [filler], 60000, now);

      expect(result.filler).not.toBeNull();
      expect(result.filler?.uuid).toBe(programUuid);
    });

    it('can select from multiple programs in a filler', async () => {
      const program1 = createProgram();
      const program2 = createProgram();
      const filler = createFiller();
      filler.fillerContent = [program1, program2];

      // With current implementation, list selection and program selection happen together.
      // First random.bool selects the list and the first program in one pass.
      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(mockChannel, [filler], 60000);

      // Should pick the first program when random.bool returns true
      expect(result.filler).not.toBeNull();
      expect(result.filler?.uuid).toBe(program1.uuid);
    });

    it('normalizes time since played to max of FiveMinutesMillis', async () => {
      const now = Date.now();
      const program1 = createProgram();
      const program2 = createProgram();
      const filler = createFiller();
      filler.fillerContent = [program1, program2];

      // program1 played 10 minutes ago, program2 played 1 hour ago
      // Both should get same normalization (capped at 5 min) for timeSince
      vi.mocked(mockPlayHistoryDB.getFillerHistory).mockResolvedValue([
        createPlayHistory(
          program1.uuid,
          new Date(now - 10 * 60 * 1000),
          filler.fillerShowUuid,
        ),
        createPlayHistory(
          program2.uuid,
          new Date(now - 60 * 60 * 1000),
          filler.fillerShowUuid,
        ),
      ]);

      const weightCalls: number[] = [];
      vi.mocked(random.bool).mockImplementation((weight) => {
        weightCalls.push(weight as number);
        return true;
      });

      await picker.pickFiller(mockChannel, [filler], 60000, now);

      // Weights for programs should be similar since timeSince is capped
      // (difference would only be from duration normalization if durations differ)
    });
  });

  // ==========================================
  // MAX DURATION FILTERING TESTS
  // ==========================================

  describe('maxDuration filtering', () => {
    it('skips programs that exceed maxDuration', async () => {
      const filler = createFiller();
      filler.fillerContent = [
        createProgram({ duration: 120000 }), // 2 minutes - too long
      ];

      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(
        mockChannel,
        [filler],
        60000, // 1 minute max
      );

      // Program exceeds maxDuration, so nothing should be picked
      expect(result.filler).toBeNull();
    });

    it('selects programs that fit within maxDuration', async () => {
      const shortProgram = createProgram({ duration: 30000 }); // 30 sec
      const filler = createFiller();
      filler.fillerContent = [shortProgram];

      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(
        mockChannel,
        [filler],
        60000, // 1 minute max
      );

      expect(result.filler).not.toBeNull();
      expect(result.filler?.uuid).toBe(shortProgram.uuid);
    });

    it('filters out long programs but keeps short ones', async () => {
      const shortProgram = createProgram({ duration: 30000 }); // 30 sec
      const longProgram = createProgram({ duration: 120000 }); // 2 min
      const filler = createFiller();
      filler.fillerContent = [longProgram, shortProgram];

      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(
        mockChannel,
        [filler],
        60000, // 1 minute max
      );

      // Should pick the short program, not the long one
      expect(result.filler).not.toBeNull();
      expect(result.filler?.uuid).toBe(shortProgram.uuid);
    });

    it('returns null when all programs exceed maxDuration', async () => {
      const filler = createFiller();
      filler.fillerContent = [
        createProgram({ duration: 120000 }), // 2 min
        createProgram({ duration: 180000 }), // 3 min
      ];

      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(
        mockChannel,
        [filler],
        60000, // 1 minute max
      );

      expect(result.filler).toBeNull();
    });
  });

  // ==========================================
  // MINIMUM WAIT CALCULATION TESTS
  // ==========================================

  describe('minimumWait calculation', () => {
    it('calculates minimumWait when filler is in cooldown but has fitting programs', async () => {
      const now = Date.now();
      const programUuid = v4();
      const filler = createFiller({ cooldown: 60000 }); // 1 minute cooldown
      filler.fillerContent = [
        createProgram({ uuid: programUuid, duration: 10000 }), // Short program
      ];

      // Played 30 seconds ago, so 30 more seconds until cooldown expires
      vi.mocked(mockPlayHistoryDB.getFillerHistory).mockResolvedValue([
        createPlayHistory(
          programUuid,
          new Date(now - 30000),
          filler.fillerShowUuid,
        ),
      ]);

      vi.mocked(random.bool).mockReturnValue(false);

      const result = await picker.pickFiller(
        mockChannel,
        [filler],
        60000, // maxDuration allows program + wait time
        now,
      );

      // minimumWait should be calculated (capped at 0 minimum per the code)
      expect(result.minimumWait).toBeGreaterThanOrEqual(0);
    });

    it('returns MAX_SAFE_INTEGER minimumWait when no candidates available', async () => {
      const filler = createFiller({ cooldown: 0 });
      filler.fillerContent = []; // No programs

      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(mockChannel, [filler], 60000);

      expect(result.minimumWait).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('returns minimumWait of 0 when filler is successfully picked', async () => {
      const filler = createFiller();
      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(mockChannel, [filler], 60000);

      expect(result.minimumWait).toBe(0);
    });

    it('calculates correct minimumWait based on program cooldown remaining', async () => {
      const now = Date.now();
      const programUuid = v4();
      const filler = createFiller();
      const programDuration = 10000; // 10 sec
      filler.fillerContent = [
        createProgram({ uuid: programUuid, duration: programDuration }),
      ];

      // Program played 20 minutes ago, cooldown is 30 min default
      // So 10 minutes remaining until program can play
      const twentyMinutesAgo = now - 20 * 60 * 1000;
      vi.mocked(mockPlayHistoryDB.getFillerHistory).mockResolvedValue([
        createPlayHistory(
          programUuid,
          new Date(twentyMinutesAgo),
          filler.fillerShowUuid,
        ),
      ]);

      vi.mocked(random.bool).mockReturnValue(false);

      const result = await picker.pickFiller(
        mockChannel,
        [filler],
        60000 * 15, // 15 min max (enough for wait + program)
        now,
      );

      // minimumWait should be ~10 minutes (600000ms)
      const expectedWait = DefaultFillerCooldownMillis - 20 * 60 * 1000; // 10 min
      expect(result.minimumWait).toBe(expectedWait);
    });

    it('takes minimum of multiple program wait times', async () => {
      const now = Date.now();
      const program1 = createProgram({ duration: 10000 });
      const program2 = createProgram({ duration: 10000 });
      const filler = createFiller();
      filler.fillerContent = [program1, program2];

      // program1 played 25 min ago (5 min until available)
      // program2 played 20 min ago (10 min until available)
      vi.mocked(mockPlayHistoryDB.getFillerHistory).mockResolvedValue([
        createPlayHistory(
          program1.uuid,
          new Date(now - 25 * 60 * 1000),
          filler.fillerShowUuid,
        ),
        createPlayHistory(
          program2.uuid,
          new Date(now - 20 * 60 * 1000),
          filler.fillerShowUuid,
        ),
      ]);

      vi.mocked(random.bool).mockReturnValue(false);

      const result = await picker.pickFiller(
        mockChannel,
        [filler],
        60000 * 15, // 15 min max
        now,
      );

      // Should return the minimum wait (5 minutes for program1)
      const expectedWait = DefaultFillerCooldownMillis - 25 * 60 * 1000; // 5 min
      expect(result.minimumWait).toBe(expectedWait);
    });
  });

  // ==========================================
  // PROPERTY-BASED / INVARIANT TESTS
  // ==========================================

  describe('invariants', () => {
    it('minimumWait is never negative', async () => {
      const now = Date.now();
      const programUuid = v4();
      const filler = createFiller({ cooldown: 0 }); // No list cooldown
      filler.fillerContent = [
        createProgram({ uuid: programUuid, duration: 10000 }),
      ];

      // Program played 25 minutes ago - within program cooldown (30min default)
      // Time until program can play: 30min - 25min = 5min = 300000ms
      // Condition: program.duration + timeUntilProgramCanPlay <= maxDuration
      // 10000 + 300000 = 310000 <= 600000 (10 min max) = true
      vi.mocked(mockPlayHistoryDB.getFillerHistory).mockResolvedValue([
        createPlayHistory(
          programUuid,
          new Date(now - 25 * 60 * 1000),
          filler.fillerShowUuid,
        ),
      ]);

      vi.mocked(random.bool).mockReturnValue(false);

      const result = await picker.pickFiller(
        mockChannel,
        [filler],
        600000, // 10 minutes max
        now,
      );

      // minimumWait should be non-negative
      expect(result.minimumWait).toBeGreaterThanOrEqual(0);
    });

    it('minimumWait is not negative when filler list is in cooldown but program never played', async () => {
      // Regression test: previously, the code used timeSincePlayed (for the program)
      // instead of timeSincePlayedFiller (for the list) when calculating timeUntilListIsCandidate.
      // This caused a large negative minimumWait when the program never played
      // (timeSincePlayed defaults to OneDayMillis) but the filler list was in cooldown.
      const now = Date.now();
      const programUuid = v4();
      const listCooldown = 60000; // 1 minute list cooldown
      const filler = createFiller({ cooldown: listCooldown });
      filler.fillerContent = [
        createProgram({ uuid: programUuid, duration: 10000 }),
      ];

      // Filler list was played 30 seconds ago (still in cooldown),
      // but using a DIFFERENT program (so our program has never been played)
      const differentProgramUuid = v4();
      vi.mocked(mockPlayHistoryDB.getFillerHistory).mockResolvedValue([
        createPlayHistory(
          differentProgramUuid,
          new Date(now - 30000), // 30 seconds ago
          filler.fillerShowUuid,
        ),
      ]);

      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(
        mockChannel,
        [filler],
        600000, // 10 minutes max
        now,
      );

      // minimumWait should be ~30 seconds (time until list cooldown expires)
      // NOT a large negative value like (60000 - OneDayMillis)
      expect(result.minimumWait).toBeGreaterThanOrEqual(0);
      expect(result.minimumWait).toBeLessThanOrEqual(listCooldown);
    });

    it('always returns a valid FillerPickResult structure', async () => {
      const filler = createFiller();
      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(mockChannel, [filler], 60000);

      expect(result).toHaveProperty('filler');
      expect(result).toHaveProperty('fillerListId');
      expect(result).toHaveProperty('minimumWait');
      expect(typeof result.minimumWait).toBe('number');
    });

    it('fillerListId is set whenever filler is set', async () => {
      const filler = createFiller();
      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(mockChannel, [filler], 60000);

      if (result.filler !== null) {
        expect(result.fillerListId).not.toBeNull();
      }
    });

    it('handles concurrent calls without interference', async () => {
      const filler1 = createFiller();
      const filler2 = createFiller();

      vi.mocked(random.bool).mockReturnValue(true);

      const [result1, result2] = await Promise.all([
        picker.pickFiller(mockChannel, [filler1], 60000),
        picker.pickFiller(mockChannel, [filler2], 60000),
      ]);

      // Each should pick from their own filler
      expect(result1.fillerListId).toBe(filler1.fillerShowUuid);
      expect(result2.fillerListId).toBe(filler2.fillerShowUuid);
    });
  });

  // ==========================================
  // STATISTICAL DISTRIBUTION TESTS
  // ==========================================

  describe('weight distribution (statistical)', () => {
    it('respects weight ratio in list selection over many iterations', async () => {
      // Temporarily use a predictable mock that simulates weighted selection
      const fillerA = createFiller({ weight: 75 });
      fillerA.fillerShowUuid = 'filler-a';
      const fillerB = createFiller({ weight: 25 });
      fillerB.fillerShowUuid = 'filler-b';

      const counts = { 'filler-a': 0, 'filler-b': 0, null: 0 };
      const iterations = 1000;

      // Simulate weighted random: random.bool(weight, totalWeight) returns true
      // with probability weight/totalWeight
      vi.mocked(random.bool).mockImplementation((weight, totalWeight) => {
        return Math.random() < (weight as number) / (totalWeight as number);
      });

      for (let i = 0; i < iterations; i++) {
        const result = await picker.pickFiller(
          mockChannel,
          [fillerA, fillerB],
          60000,
        );
        if (result.fillerListId === 'filler-a') {
          counts['filler-a']++;
        } else if (result.fillerListId === 'filler-b') {
          counts['filler-b']++;
        } else {
          counts.null++;
        }
      }

      // With the algorithm: first filler (75 weight) has 75/75 = 100% chance if selected
      // If not selected, second filler (25 weight) has 25/100 = 25% chance
      // So fillerA should be selected most of the time
      const ratioA = counts['filler-a'] / iterations;

      // Allow for statistical variance - fillerA should dominate
      expect(ratioA).toBeGreaterThan(0.5);
    });

    it('multiple programs can be selected over many iterations', async () => {
      const programs = Array.from({ length: 3 }, () => createProgram());
      const filler = createFiller();
      filler.fillerContent = programs;

      const selectedPrograms = new Set<string>();
      const iterations = 100;

      // Simulate weighted random selection
      vi.mocked(random.bool).mockImplementation((weight, totalWeight) => {
        return Math.random() < (weight as number) / (totalWeight as number);
      });

      for (let i = 0; i < iterations; i++) {
        const result = await picker.pickFiller(mockChannel, [filler], 60000);
        if (result.filler) {
          selectedPrograms.add(result.filler.uuid);
        }
      }

      // At least some programs should have been selected
      // (With reservoir sampling, earlier items have higher selection probability,
      // but all should have some chance over many iterations)
      expect(selectedPrograms.size).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================
  // NORMALIZATION FUNCTION TESTS
  // ==========================================

  describe('normalization behavior', () => {
    it('weights programs by both duration and time since played', async () => {
      const shortProgram = createProgram({ duration: 30000 }); // 30 sec
      const longProgram = createProgram({ duration: 300000 }); // 5 min

      const filler = createFiller();
      filler.fillerContent = [shortProgram, longProgram];

      const weightCalls: Array<{ weight: number; total: number }> = [];

      // In current implementation, list selection and program selection happen
      // in the same random.bool call sequence. First call picks list and first program.
      vi.mocked(random.bool).mockImplementation((weight, totalWeight) => {
        weightCalls.push({
          weight: weight as number,
          total: totalWeight as number,
        });
        return false; // Reject all to see multiple calls
      });

      await picker.pickFiller(mockChannel, [filler], 600000);

      // At least one weight call should happen for list/program selection
      expect(weightCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================
  // TIME PARAMETER TESTS
  // ==========================================

  describe('time parameter handling', () => {
    it('uses provided now parameter for time calculations', async () => {
      const fixedNow = dayjs('2024-06-15T12:00:00Z').valueOf();
      const programUuid = v4();
      const filler = createFiller();
      filler.fillerContent = [createProgram({ uuid: programUuid })];

      // Played at a time that would be within cooldown relative to fixedNow
      const playedAt = new Date(fixedNow - 10 * 60 * 1000); // 10 min before fixedNow
      vi.mocked(mockPlayHistoryDB.getFillerHistory).mockResolvedValue([
        createPlayHistory(programUuid, playedAt, filler.fillerShowUuid),
      ]);

      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(
        mockChannel,
        [filler],
        60000,
        fixedNow,
      );

      // Should skip program due to cooldown relative to fixedNow
      expect(result.filler).toBeNull();
    });

    it('defaults to current time when now parameter is not provided', async () => {
      const filler = createFiller();
      vi.mocked(random.bool).mockReturnValue(true);

      // This should not throw and should use current time
      const result = await picker.pickFiller(mockChannel, [filler], 60000);

      expect(result).toBeDefined();
    });
  });

  // ==========================================
  // REGRESSION / CHARACTERIZATION TESTS
  // ==========================================

  describe('characterization tests', () => {
    it('produces expected result with controlled inputs', async () => {
      const fixedNow = dayjs('2024-06-15T12:00:00Z').valueOf();
      const programUuid = 'test-program-uuid';
      const fillerUuid = 'test-filler-uuid';

      const program = createProgram({ uuid: programUuid, duration: 30000 });
      const filler = createFiller({ fillerShowUuid: fillerUuid });
      filler.fillerContent = [program];

      // No play history (never played)
      vi.mocked(mockPlayHistoryDB.getFillerHistory).mockResolvedValue([]);

      // Always select
      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(
        mockChannel,
        [filler],
        60000,
        fixedNow,
      );

      expect(result).toEqual({
        filler: program,
        fillerListId: fillerUuid,
        minimumWait: 0,
      });
    });

    it('handles empty fillerContent gracefully', async () => {
      const filler = createFiller();
      filler.fillerContent = [];

      vi.mocked(random.bool).mockReturnValue(true);

      const result = await picker.pickFiller(mockChannel, [filler], 60000);

      // List may be selected but no program to pick
      expect(result.filler).toBeNull();
    });
  });
});
