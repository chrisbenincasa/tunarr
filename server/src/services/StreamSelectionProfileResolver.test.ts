import type { FfmpegSettings, StreamSelectionProfile } from '@tunarr/types';
import { describe, expect, it, vi } from 'vitest';
import type { ChannelSubtitlePreferences } from '../db/schema/SubtitlePreferences.ts';
import type { IChannelDB } from '../db/interfaces/IChannelDB.ts';
import type { ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import type { DrizzleDBAccess } from '../db/schema/index.ts';
import { StreamSelectionProfileResolver } from './StreamSelectionProfileResolver.ts';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFfmpegSettings(
  overrides: Partial<FfmpegSettings> = {},
): FfmpegSettings {
  return {
    ...overrides,
  } as FfmpegSettings;
}

function makeSubtitlePref(
  overrides: Partial<ChannelSubtitlePreferences>,
): ChannelSubtitlePreferences {
  return {
    uuid: 'sub-pref-1',
    channelId: 'channel-1',
    languageCode: 'eng',
    priority: 0,
    allowImageBased: true,
    allowExternal: true,
    filterType: 'any',
    ...overrides,
  } as ChannelSubtitlePreferences;
}

function makeProfile(
  overrides: Partial<StreamSelectionProfile> = {},
): StreamSelectionProfile {
  return {
    uuid: 'profile-1',
    name: 'Test Profile',
    rules: [
      {
        label: 'default rule',
        condition: 'true',
        audioAction: { type: 'default' },
        subtitleAction: { type: 'disable' },
      },
    ],
    ...overrides,
  };
}

// Create a resolver with mocked dependencies, allowing private method overrides
function createResolver(opts: {
  ffmpegSettings?: FfmpegSettings;
  subtitlePrefs?: ChannelSubtitlePreferences[];
  programProfile?: StreamSelectionProfile | undefined;
  fillerProfile?: StreamSelectionProfile | undefined;
  channelProfile?: StreamSelectionProfile | undefined;
}) {
  const settingsDB = {
    ffmpegSettings: vi
      .fn()
      .mockReturnValue(opts.ffmpegSettings ?? makeFfmpegSettings()),
  } as unknown as ISettingsDB;

  const channelDB = {
    getChannelSubtitlePreferences: vi
      .fn()
      .mockResolvedValue(opts.subtitlePrefs ?? []),
  } as unknown as IChannelDB;

  // Drizzle is only used in getProfileFor* methods which we override
  const drizzle = {} as unknown as DrizzleDBAccess;

  const resolver = new StreamSelectionProfileResolver(
    drizzle,
    settingsDB,
    channelDB,
  );

  // Override the private DB-hitting methods to control test flow
  vi.spyOn(resolver as never, 'getProfileForProgram').mockResolvedValue(
    opts.programProfile as never,
  );
  vi.spyOn(resolver as never, 'getProfileForFillerList').mockResolvedValue(
    opts.fillerProfile as never,
  );
  vi.spyOn(resolver as never, 'getProfileForChannel').mockResolvedValue(
    opts.channelProfile as never,
  );

  return { resolver, settingsDB, channelDB };
}

// ── resolve() priority logic ────────────────────────────────────────────────

describe('StreamSelectionProfileResolver', () => {
  describe('resolve', () => {
    it('returns program-level profile when available', async () => {
      const programProfile = makeProfile({
        uuid: 'prog-profile',
        name: 'Program Profile',
      });
      const channelProfile = makeProfile({
        uuid: 'chan-profile',
        name: 'Channel Profile',
      });

      const { resolver } = createResolver({
        programProfile,
        channelProfile,
      });

      const result = await resolver.resolve({
        channelId: 'channel-1',
        programId: 'program-1',
      });

      expect(result.uuid).toBe('prog-profile');
      expect(result.name).toBe('Program Profile');
    });

    it('falls through to filler profile when no program profile', async () => {
      const fillerProfile = makeProfile({
        uuid: 'filler-profile',
        name: 'Filler Profile',
      });

      const { resolver } = createResolver({
        programProfile: undefined,
        fillerProfile,
      });

      const result = await resolver.resolve({
        channelId: 'channel-1',
        programId: 'program-1',
        fillerListId: 'filler-1',
      });

      expect(result.uuid).toBe('filler-profile');
    });

    it('falls through to channel profile when no program or filler profile', async () => {
      const channelProfile = makeProfile({
        uuid: 'chan-profile',
        name: 'Channel Profile',
      });

      const { resolver } = createResolver({
        programProfile: undefined,
        fillerProfile: undefined,
        channelProfile,
      });

      const result = await resolver.resolve({
        channelId: 'channel-1',
        programId: 'program-1',
        fillerListId: 'filler-1',
      });

      expect(result.uuid).toBe('chan-profile');
    });

    it('builds legacy profile when no profiles exist', async () => {
      const { resolver } = createResolver({
        programProfile: undefined,
        fillerProfile: undefined,
        channelProfile: undefined,
        ffmpegSettings: makeFfmpegSettings(),
        subtitlePrefs: [],
      });

      const result = await resolver.resolve({
        channelId: 'channel-1',
      });

      expect(result.uuid).toBe('legacy-channel-1');
      expect(result.name).toBe('Legacy Settings');
      expect(result.rules).toHaveLength(1);
    });

    it('skips program lookup when no programId', async () => {
      const channelProfile = makeProfile({ uuid: 'chan-profile' });
      const { resolver } = createResolver({
        programProfile: makeProfile({ uuid: 'should-not-be-used' }),
        channelProfile,
      });

      const result = await resolver.resolve({
        channelId: 'channel-1',
        // no programId
      });

      // Should skip program lookup entirely
      expect(result.uuid).toBe('chan-profile');
    });

    it('skips filler lookup when no fillerListId', async () => {
      const channelProfile = makeProfile({ uuid: 'chan-profile' });
      const { resolver } = createResolver({
        programProfile: undefined,
        fillerProfile: makeProfile({ uuid: 'should-not-be-used' }),
        channelProfile,
      });

      const result = await resolver.resolve({
        channelId: 'channel-1',
        programId: 'prog-1',
        // no fillerListId
      });

      expect(result.uuid).toBe('chan-profile');
    });
  });

  describe('buildLegacyProfile', () => {
    it('creates default audio and subtitle actions when no preferences', async () => {
      const { resolver } = createResolver({
        programProfile: undefined,
        fillerProfile: undefined,
        channelProfile: undefined,
        ffmpegSettings: makeFfmpegSettings(),
        subtitlePrefs: [],
      });

      const result = await resolver.resolve({ channelId: 'ch-1' });

      expect(result.rules).toHaveLength(1);
      const rule = result.rules[0]!;
      expect(rule.condition).toBe('true');
      expect(rule.audioAction).toEqual({ type: 'default' });
      expect(rule.subtitleAction).toEqual({ type: 'default' });
    });

    it('creates by_language audio action from ffmpeg language preferences', async () => {
      const { resolver } = createResolver({
        programProfile: undefined,
        fillerProfile: undefined,
        channelProfile: undefined,
        ffmpegSettings: makeFfmpegSettings({
          languagePreferences: {
            preferences: [{ iso6392: 'jpn' }, { iso6392: 'eng' }],
          },
        } as FfmpegSettings),
        subtitlePrefs: [],
      });

      const result = await resolver.resolve({ channelId: 'ch-1' });

      const rule = result.rules[0]!;
      expect(rule.audioAction).toEqual({
        type: 'by_language',
        languages: ['jpn', 'eng'],
      });
    });

    it('creates by_language subtitle action from channel subtitle prefs', async () => {
      const { resolver } = createResolver({
        programProfile: undefined,
        fillerProfile: undefined,
        channelProfile: undefined,
        ffmpegSettings: makeFfmpegSettings(),
        subtitlePrefs: [
          makeSubtitlePref({
            priority: 1,
            languageCode: 'eng',
            filterType: 'forced',
          }),
          makeSubtitlePref({
            priority: 0,
            languageCode: 'jpn',
            filterType: 'forced',
            allowImageBased: false,
            allowExternal: false,
          }),
        ],
      });

      const result = await resolver.resolve({ channelId: 'ch-1' });

      const rule = result.rules[0]!;
      expect(rule.subtitleAction).toEqual({
        type: 'by_language',
        // Languages are in priority order (priority 0 = jpn first)
        languages: ['jpn', 'eng'],
        // filterType/allowImageBased/allowExternal come from highest-priority pref (priority 0 = jpn)
        filterType: 'forced',
        allowImageBased: false,
        allowExternal: false,
      });
    });

    it('sorts subtitle prefs by priority to determine top pref', async () => {
      const { resolver } = createResolver({
        programProfile: undefined,
        fillerProfile: undefined,
        channelProfile: undefined,
        ffmpegSettings: makeFfmpegSettings(),
        subtitlePrefs: [
          makeSubtitlePref({
            priority: 2,
            languageCode: 'fra',
            filterType: 'any',
            allowImageBased: true,
          }),
          makeSubtitlePref({
            priority: 0,
            languageCode: 'eng',
            filterType: 'default',
            allowImageBased: false,
          }),
          makeSubtitlePref({
            priority: 1,
            languageCode: 'jpn',
            filterType: 'forced',
            allowImageBased: true,
          }),
        ],
      });

      const result = await resolver.resolve({ channelId: 'ch-1' });

      const rule = result.rules[0]!;
      // Top pref is priority 0 (eng) so filterType and allowImageBased come from that
      expect(rule.subtitleAction).toMatchObject({
        type: 'by_language',
        filterType: 'default',
        allowImageBased: false,
      });
    });

    it('combines both audio and subtitle preferences', async () => {
      const { resolver } = createResolver({
        programProfile: undefined,
        fillerProfile: undefined,
        channelProfile: undefined,
        ffmpegSettings: makeFfmpegSettings({
          languagePreferences: {
            preferences: [{ iso6392: 'eng' }],
          },
        } as FfmpegSettings),
        subtitlePrefs: [
          makeSubtitlePref({
            priority: 0,
            languageCode: 'eng',
            filterType: 'any',
          }),
        ],
      });

      const result = await resolver.resolve({ channelId: 'ch-1' });

      const rule = result.rules[0]!;
      expect(rule.audioAction).toEqual({
        type: 'by_language',
        languages: ['eng'],
      });
      expect(rule.subtitleAction).toMatchObject({
        type: 'by_language',
        languages: ['eng'],
      });
    });

    it('uses channelId in legacy profile uuid', async () => {
      const { resolver } = createResolver({
        programProfile: undefined,
        fillerProfile: undefined,
        channelProfile: undefined,
      });

      const result = await resolver.resolve({ channelId: 'my-channel-uuid' });

      expect(result.uuid).toBe('legacy-my-channel-uuid');
    });
  });
});
