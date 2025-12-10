import { faker } from '@faker-js/faker';
import { SaveableChannel } from '@tunarr/types';
import tmp from 'tmp-promise';
import { mock } from 'ts-mockito';
import { v4 } from 'uuid';
import { test as baseTest, describe, expect } from 'vitest';
import { bootstrapTunarr } from '../bootstrap.ts';
import { globalOptions, setGlobalOptionsUnchecked } from '../globals.ts';
import { CacheImageService } from '../services/cacheImageService.ts';
import { FileSystemService } from '../services/FileSystemService.ts';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';
import { ChannelDB } from './ChannelDB.ts';
import { ProgramConverter } from './converters/ProgramConverter.ts';
import { DBAccess } from './DBAccess.ts';
import { ContentItem } from './derived_types/Lineup.ts';
import type { IChannelDB } from './interfaces/IChannelDB.ts';
import { ChannelPrograms } from './schema/ChannelPrograms.ts';
import { Program } from './schema/Program.ts';
import { IProgramDB } from './interfaces/IProgramDB.ts';

type Fixture = {
  db: string;
  channelDb: IChannelDB;
  drizzle: any;
  defaultTranscodeConfigId: string;
};

const test = baseTest.extend<Fixture>({
  db: async ({}, use) => {
    const dbResult = await tmp.dir({ unsafeCleanup: true });
    const opts = setGlobalOptionsUnchecked({
      database: dbResult.path,
      log_level: 'debug',
      verbose: 0,
    });
    await bootstrapTunarr(opts);
    await use(dbResult.path);
    // Close the database connection before cleanup
    const dbPath = `${dbResult.path}/db.db`;
    await DBAccess.instance.closeConnection(dbPath);
    await dbResult.cleanup();
  },
  channelDb: async ({ db: _ }, use) => {
    const dbAccess = DBAccess.instance;

    const mockWorkerPoolFactory = () =>
      ({
        submit: async (task: any) => {
          if (typeof task === 'function') {
            return await task();
          }
          return task;
        },
      }) as any;

    const mockMaterializeLineupCommand = {
      execute: async () => {},
    } as any;

    const channelDb = new ChannelDB(
      new ProgramConverter(
        LoggerFactory.child({ className: ProgramConverter.name }),
        dbAccess.db!,
      ),
      mock<IProgramDB>(),
      mock(CacheImageService),
      dbAccess.db!, // Kysely instance
      mockWorkerPoolFactory,
      new FileSystemService(globalOptions()),
      dbAccess.drizzle!, // Drizzle instance
      mockMaterializeLineupCommand,
    );

    await use(channelDb);
  },
  drizzle: async ({}, use) => {
    await use(DBAccess.instance.drizzle);
  },
  defaultTranscodeConfigId: async ({ db: _ }, use) => {
    const dbAccess = DBAccess.instance;
    const config = await dbAccess
      .db!.selectFrom('transcodeConfig')
      .select('uuid')
      .where('isDefault', '=', 1)
      .executeTakeFirst();
    if (!config) {
      throw new Error('Default transcode config not found');
    }
    await use(config.uuid);
  },
});

// Helper function to create valid SaveableChannel objects
function createSaveableChannel(
  transcodeConfigId: string,
  overrides?: Partial<SaveableChannel>,
): SaveableChannel {
  return {
    id: v4(),
    name: faker.company.name(),
    number: faker.number.int({ min: 1, max: 999 }),
    startTime: Date.now(),
    duration: 0,
    offline: {
      mode: 'pic' as const,
    },
    guideMinimumDuration: 30000,
    icon: {
      path: '',
      width: 100,
      duration: 0,
      position: 'bottom-right' as const,
    },
    disableFillerOverlay: false,
    groupTitle: '',
    stealth: false,
    streamMode: 'hls' as const,
    transcodeConfigId,
    subtitlesEnabled: false,
    ...overrides,
  };
}

describe('ChannelDB', () => {
  describe('Channel CRUD Operations', () => {
    test('should create a new channel', async ({
      channelDb,
      defaultTranscodeConfigId,
    }) => {
      const channelData = createSaveableChannel(defaultTranscodeConfigId);

      const result = await channelDb.saveChannel(channelData);

      expect(result.channel.uuid).toBeDefined();
      expect(result.channel.name).toBe(channelData.name);
      expect(result.channel.number).toBe(channelData.number);
      expect(result.lineup.items).toHaveLength(0);
    });

    test('should retrieve channel by UUID', async ({
      channelDb,
      defaultTranscodeConfigId,
    }) => {
      const channelData = createSaveableChannel(defaultTranscodeConfigId, {
        name: 'Test Channel',
        number: 100,
      });

      const created = await channelDb.saveChannel(channelData);
      const retrieved = await channelDb.getChannel(created.channel.uuid);

      expect(retrieved).toBeDefined();
      expect(retrieved?.uuid).toBe(created.channel.uuid);
      expect(retrieved?.name).toBe(channelData.name);
    });

    test('should retrieve channel by number', async ({
      channelDb,
      defaultTranscodeConfigId,
    }) => {
      const channelNumber = faker.number.int({ min: 1, max: 999 });
      const channelData = createSaveableChannel(defaultTranscodeConfigId, {
        name: 'Test Channel',
        number: channelNumber,
      });

      const created = await channelDb.saveChannel(channelData);
      const retrieved = await channelDb.getChannel(channelNumber);

      expect(retrieved).toBeDefined();
      expect(retrieved?.uuid).toBe(created.channel.uuid);
      expect(retrieved?.number).toBe(channelNumber);
    });

    test('should update an existing channel', async ({
      channelDb,
      defaultTranscodeConfigId,
    }) => {
      const channelData = createSaveableChannel(defaultTranscodeConfigId, {
        name: 'Original Name',
        number: 200,
      });

      const created = await channelDb.saveChannel(channelData);

      const updateData: SaveableChannel = {
        ...channelData,
        name: 'Updated Name',
        number: 201,
      };

      const updated = await channelDb.updateChannel(
        created.channel.uuid,
        updateData,
      );

      expect(updated.channel.uuid).toBe(created.channel.uuid);
      expect(updated.channel.name).toBe('Updated Name');
      expect(updated.channel.number).toBe(201);
    });

    test('should delete a channel', async ({
      channelDb,
      drizzle,
      defaultTranscodeConfigId,
    }) => {
      const channelData = createSaveableChannel(defaultTranscodeConfigId, {
        name: 'Channel to Delete',
        number: 300,
      });

      const created = await channelDb.saveChannel(channelData);

      await channelDb.deleteChannel(created.channel.uuid);

      const retrieved = await channelDb.getChannel(created.channel.uuid);
      expect(retrieved).toBeUndefined();
    });

    test('should check if channel exists', async ({
      channelDb,
      defaultTranscodeConfigId,
    }) => {
      const channelData = createSaveableChannel(defaultTranscodeConfigId, {
        name: 'Existence Check Channel',
        number: 400,
      });

      const created = await channelDb.saveChannel(channelData);

      const exists = await channelDb.channelExists(created.channel.uuid);
      expect(exists).toBe(true);

      const notExists = await channelDb.channelExists(v4());
      expect(notExists).toBe(false);
    });

    test('should get all channels', async ({
      channelDb,
      defaultTranscodeConfigId,
    }) => {
      // Create multiple channels
      for (let i = 0; i < 3; i++) {
        const channelData = createSaveableChannel(defaultTranscodeConfigId, {
          name: `Channel ${i}`,
          number: 500 + i,
        });
        await channelDb.saveChannel(channelData);
      }

      const channels = await channelDb.getAllChannels();
      expect(channels.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Channel Lineup Operations', () => {
    test('should save and load lineup', async ({
      channelDb,
      defaultTranscodeConfigId,
    }) => {
      const channelData = createSaveableChannel(defaultTranscodeConfigId, {
        name: 'Lineup Test Channel',
        number: 600,
      });

      const created = await channelDb.saveChannel(channelData);

      const lineupData = {
        items: [
          {
            type: 'offline' as const,
            durationMs: 30000,
          },
        ],
        startTimeOffsets: [0],
      };

      await channelDb.saveLineup(created.channel.uuid, lineupData);

      const lineup = await channelDb.loadLineup(created.channel.uuid);

      expect(lineup.items).toHaveLength(1);
      expect(lineup.items[0].type).toBe('offline');
    });

    test('should load channel and lineup together', async ({
      channelDb,
      defaultTranscodeConfigId,
    }) => {
      const channelData = createSaveableChannel(defaultTranscodeConfigId, {
        name: 'Combined Load Channel',
        number: 700,
      });

      const created = await channelDb.saveChannel(channelData);

      const lineupData = {
        items: [
          {
            type: 'offline' as const,
            durationMs: 60000,
          },
        ],
        startTimeOffsets: [0],
      };

      await channelDb.saveLineup(created.channel.uuid, lineupData);

      const result = await channelDb.loadChannelAndLineup(created.channel.uuid);

      expect(result).toBeDefined();
      expect(result?.channel.uuid).toBe(created.channel.uuid);
      expect(result?.lineup.items).toHaveLength(1);
    });

    test('should load condensed lineup with offset and limit', async ({
      channelDb,
      defaultTranscodeConfigId,
      drizzle,
    }) => {
      const channelData = createSaveableChannel(defaultTranscodeConfigId, {
        name: 'Condensed Lineup Channel',
        number: 800,
      });

      const created = await channelDb.saveChannel(channelData);

      // Create 10 programs and associate them with the channel
      const programIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const programId = v4();
        await drizzle.insert(Program).values({
          uuid: programId,
          duration: 30000,
          type: 'movie',
          sourceType: 'plex',
          externalKey: faker.string.alphanumeric(),
          externalSourceId: faker.string.alphanumeric(),
          title: `Test Movie ${i}`,
          year: 2020 + i,
        });

        // Associate program with channel
        await drizzle.insert(ChannelPrograms).values({
          channelUuid: created.channel.uuid,
          programUuid: programId,
        });

        programIds.push(programId);
      }

      // Create lineup with the created programs
      const lineupData = {
        items: programIds.map(
          (id) =>
            ({
              type: 'content' as const,
              id,
              durationMs: 30000,
            }) satisfies ContentItem,
        ),
        startTimeOffsets: Array.from({ length: 10 }, (_, i) => i * 30000),
      };

      await channelDb.saveLineup(created.channel.uuid, lineupData);

      // Load with offset and limit
      const condensed = await channelDb.loadCondensedLineup(
        created.channel.uuid,
        2,
        5,
      );

      expect(condensed).toBeDefined();
      expect(condensed?.lineup).toBeDefined();
      expect(condensed?.lineup.length).toBeLessThanOrEqual(5);
      expect(condensed?.lineup.length).toBeGreaterThan(0);
    });

    test('should update lineup config', async ({
      channelDb,
      defaultTranscodeConfigId,
    }) => {
      const channelData = createSaveableChannel(defaultTranscodeConfigId, {
        name: 'Config Update Channel',
        number: 900,
      });

      const created = await channelDb.saveChannel(channelData);

      // Should not throw
      await expect(
        channelDb.updateLineupConfig(
          created.channel.uuid,
          'channelId',
          created.channel.uuid,
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('Channel Start Time Management', () => {
    test('should update channel start time', async ({
      channelDb,
      defaultTranscodeConfigId,
    }) => {
      const channelData = createSaveableChannel(defaultTranscodeConfigId, {
        name: 'Start Time Channel',
        number: 1000,
        startTime: 1000000,
      });

      const created = await channelDb.saveChannel(channelData);
      const newStartTime = Date.now();

      await channelDb.updateChannelStartTime(
        created.channel.uuid,
        newStartTime,
      );

      const retrieved = await channelDb.getChannel(created.channel.uuid);
      expect(retrieved?.startTime).toBe(newStartTime);
    });

    test('should sync channel duration', async ({
      channelDb,
      defaultTranscodeConfigId,
    }) => {
      const channelData = createSaveableChannel(defaultTranscodeConfigId, {
        name: 'Duration Sync Channel',
        number: 1100,
      });

      const created = await channelDb.saveChannel(channelData);

      // Create lineup
      const lineupData = {
        items: [
          {
            type: 'offline' as const,
            durationMs: 60000,
          },
          {
            type: 'offline' as const,
            durationMs: 120000,
          },
        ],
        startTimeOffsets: [0, 60000],
      };

      await channelDb.saveLineup(created.channel.uuid, lineupData);
      // await channelDb.du(created.channel.uuid);

      const retrieved = await channelDb.getChannel(created.channel.uuid);
      expect(retrieved?.duration).toBe(180000); // Sum of durations
    });
  });

  describe('Channel Copy Operation', () => {
    test('should copy a channel with new number', async ({
      channelDb,
      defaultTranscodeConfigId,
    }) => {
      const channelData = createSaveableChannel(defaultTranscodeConfigId, {
        name: 'Original Channel',
        number: 1200,
      });

      const created = await channelDb.saveChannel(channelData);

      const copied = await channelDb.copyChannel(created.channel.uuid);

      expect(copied.channel.uuid).not.toBe(created.channel.uuid);
      expect(copied.channel.name).toContain('Copy');
      expect(copied.channel.number).not.toBe(created.channel.number);
    });

    test('should copy channel lineup', async ({
      channelDb,
      defaultTranscodeConfigId,
    }) => {
      const channelData = createSaveableChannel(defaultTranscodeConfigId, {
        name: 'Original with Lineup',
        number: 1300,
      });

      const created = await channelDb.saveChannel(channelData);

      const lineupData = {
        items: [
          {
            type: 'offline' as const,
            durationMs: 30000,
          },
          {
            type: 'offline' as const,
            durationMs: 60000,
          },
        ],
        startTimeOffsets: [0, 30000],
      };

      await channelDb.saveLineup(created.channel.uuid, lineupData);

      const copied = await channelDb.copyChannel(created.channel.uuid);

      expect(copied.lineup.items).toHaveLength(2);
      expect(copied.lineup.items[0].durationMs).toBe(30000);
      expect(copied.lineup.items[1].durationMs).toBe(60000);
    });
  });

  describe('Batch Operations', () => {
    test('should load all lineups', async ({
      channelDb,
      defaultTranscodeConfigId,
    }) => {
      // Create multiple channels with lineups
      for (let i = 0; i < 3; i++) {
        const channelData = createSaveableChannel(defaultTranscodeConfigId, {
          name: `Batch Channel ${i}`,
          number: 1400 + i,
        });

        const created = await channelDb.saveChannel(channelData);

        const lineupData = {
          items: [
            {
              type: 'offline' as const,
              durationMs: 30000,
            },
          ],
          startTimeOffsets: [0],
        };

        await channelDb.saveLineup(created.channel.uuid, lineupData);
      }

      const allLineups = await channelDb.loadAllLineupConfigs();
      expect(Object.keys(allLineups).length).toBeGreaterThanOrEqual(3);
    });

    test('should load all raw lineups', async ({
      channelDb,
      defaultTranscodeConfigId,
    }) => {
      const channelData = createSaveableChannel(defaultTranscodeConfigId, {
        name: 'Raw Lineup Channel',
        number: 1500,
      });

      const created = await channelDb.saveChannel(channelData);

      const lineupData = {
        items: [
          {
            type: 'offline' as const,
            durationMs: 30000,
          },
        ],
        startTimeOffsets: [0],
      };

      await channelDb.saveLineup(created.channel.uuid, lineupData);

      const rawLineups = await channelDb.loadAllRawLineups();
      expect(Object.keys(rawLineups).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error Handling', () => {
    test('should return undefined for non-existent channel', async ({
      channelDb,
    }) => {
      const nonExistentId = v4();
      const channel = await channelDb.getChannel(nonExistentId);
      expect(channel).toBeUndefined();
    });

    test('should handle delete of non-existent channel', async ({
      channelDb,
    }) => {
      const nonExistentId = v4();
      // Should not throw
      await expect(
        channelDb.deleteChannel(nonExistentId),
      ).resolves.not.toThrow();
    });

    test('should return null for non-existent channel lineup', async ({
      channelDb,
    }) => {
      const nonExistentId = v4();
      const lineup = await channelDb.loadChannelAndLineup(nonExistentId);
      expect(lineup).toBeNull();
    });
  });
});
