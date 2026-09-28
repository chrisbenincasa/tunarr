import type { StreamSelectionProfile } from '@tunarr/types/schemas';
import { BuiltInStreamSelectionProfileId } from '@tunarr/types/schemas';
import { describe, expect, it, vi } from 'vitest';
import type { ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import type { DrizzleDBAccess } from '../db/schema/index.ts';
import {
  BuiltInStreamSelectionProfile,
  StreamSelectionProfileResolver,
} from './StreamSelectionProfileResolver.ts';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeProfile(
  uuid: string,
  overrides: Partial<StreamSelectionProfile> = {},
): StreamSelectionProfile {
  return {
    uuid,
    name: `Profile ${uuid}`,
    locked: false,
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

const builtIn = { ...BuiltInStreamSelectionProfile };

// Create a resolver whose private DB lookups are replaced by the given
// profiles, keyed by the entity they are assigned to.
function createResolver(opts: {
  programProfile?: StreamSelectionProfile;
  customShowProfile?: StreamSelectionProfile;
  fillerProfile?: StreamSelectionProfile;
  channelProfile?: StreamSelectionProfile;
  defaultProfileId?: string;
  profilesById?: Record<string, StreamSelectionProfile>;
}) {
  const settingsDB = {
    streamSelectionSettings: vi.fn().mockReturnValue({
      defaultProfileId:
        opts.defaultProfileId ?? BuiltInStreamSelectionProfileId,
    }),
  } as unknown as ISettingsDB;

  const resolver = new StreamSelectionProfileResolver(
    {} as unknown as DrizzleDBAccess,
    settingsDB,
  );

  const profilesById: Record<string, StreamSelectionProfile> = {
    [BuiltInStreamSelectionProfileId]: builtIn,
    ...opts.profilesById,
  };

  const spies = {
    program: vi
      .spyOn(resolver as never, 'getProfileForProgram')
      .mockResolvedValue(opts.programProfile as never),
    customShow: vi
      .spyOn(resolver as never, 'getProfileForCustomShow')
      .mockResolvedValue(opts.customShowProfile as never),
    filler: vi
      .spyOn(resolver as never, 'getProfileForFillerList')
      .mockResolvedValue(opts.fillerProfile as never),
    channel: vi
      .spyOn(resolver as never, 'getProfileForChannel')
      .mockResolvedValue(opts.channelProfile as never),
    byId: vi
      .spyOn(resolver as never, 'getProfileById')
      .mockImplementation(((id: string) =>
        Promise.resolve(profilesById[id])) as never),
  };

  return { resolver, spies };
}

// ── resolveChain() ──────────────────────────────────────────────────────────

describe('StreamSelectionProfileResolver', () => {
  describe('resolveChain', () => {
    it('orders profiles from most to least specific', async () => {
      const program = makeProfile('program');
      const filler = makeProfile('filler');
      const channel = makeProfile('channel');
      const defaultProfile = makeProfile('default');
      const { resolver } = createResolver({
        programProfile: program,
        fillerProfile: filler,
        channelProfile: channel,
        defaultProfileId: 'default',
        profilesById: { default: defaultProfile },
      });

      const chain = await resolver.resolveChain({
        channelId: 'ch-1',
        programId: 'prog-1',
        fillerListId: 'filler-1',
      });

      expect(chain.map((c) => [c.level, c.profile.uuid, c.sourceId])).toEqual([
        ['program', 'program', 'prog-1'],
        ['filler', 'filler', 'filler-1'],
        ['channel', 'channel', 'ch-1'],
        ['default', 'default', undefined],
        ['built_in', BuiltInStreamSelectionProfileId, undefined],
      ]);
    });

    it('ends with only the built-in profile when nothing is assigned', async () => {
      const { resolver } = createResolver({});

      const chain = await resolver.resolveChain({ channelId: 'ch-1' });

      expect(chain).toHaveLength(1);
      expect(chain[0]?.level).toBe('built_in');
      expect(chain[0]?.profile.uuid).toBe(BuiltInStreamSelectionProfileId);
    });

    it('uses the custom show profile at the source level', async () => {
      const customShow = makeProfile('custom-show');
      const { resolver, spies } = createResolver({
        customShowProfile: customShow,
      });

      const chain = await resolver.resolveChain({
        channelId: 'ch-1',
        customShowId: 'cs-1',
      });

      expect(chain[0]).toMatchObject({
        level: 'custom_show',
        sourceId: 'cs-1',
        profile: customShow,
      });
      expect(spies.filler).not.toHaveBeenCalled();
    });

    it('prefers the filler list if both source IDs are present', async () => {
      const { resolver, spies } = createResolver({
        fillerProfile: makeProfile('filler'),
        customShowProfile: makeProfile('custom-show'),
      });

      const chain = await resolver.resolveChain({
        channelId: 'ch-1',
        fillerListId: 'filler-1',
        customShowId: 'cs-1',
      });

      expect(chain[0]?.level).toBe('filler');
      expect(spies.customShow).not.toHaveBeenCalled();
    });

    it('skips lookups for IDs not in the context', async () => {
      const { resolver, spies } = createResolver({});

      await resolver.resolveChain({ channelId: 'ch-1' });

      expect(spies.program).not.toHaveBeenCalled();
      expect(spies.filler).not.toHaveBeenCalled();
      expect(spies.customShow).not.toHaveBeenCalled();
      expect(spies.channel).toHaveBeenCalledWith('ch-1');
    });

    it('includes a profile only once, at its most specific level', async () => {
      const shared = makeProfile('shared');
      const { resolver } = createResolver({
        channelProfile: shared,
        defaultProfileId: 'shared',
        profilesById: { shared },
      });

      const chain = await resolver.resolveChain({ channelId: 'ch-1' });

      expect(chain.map((c) => c.level)).toEqual(['channel', 'built_in']);
    });

    it('skips a default pointer that targets a missing profile', async () => {
      const { resolver } = createResolver({ defaultProfileId: 'missing' });

      const chain = await resolver.resolveChain({ channelId: 'ch-1' });

      expect(chain.map((c) => c.level)).toEqual(['built_in']);
    });

    it('falls back to the in-code built-in profile if the row is missing', async () => {
      const { resolver, spies } = createResolver({});
      spies.byId.mockResolvedValue(undefined as never);

      const chain = await resolver.resolveChain({ channelId: 'ch-1' });

      expect(chain).toEqual([
        { level: 'built_in', profile: BuiltInStreamSelectionProfile },
      ]);
    });
  });

  describe('channelMayPickSubtitles', () => {
    it('is false when every channel-wide profile disables subtitles', async () => {
      const { resolver } = createResolver({
        channelProfile: makeProfile('channel'),
      });

      expect(await resolver.channelMayPickSubtitles('ch-1')).toBe(false);
    });

    it('is true when any channel-wide rule can select subtitles', async () => {
      const { resolver } = createResolver({
        channelProfile: makeProfile('channel', {
          rules: [
            {
              condition: 'program.type == "movie"',
              audioAction: { type: 'default' },
              subtitleAction: { type: 'default', preferTextBased: false },
            },
          ],
        }),
      });

      expect(await resolver.channelMayPickSubtitles('ch-1')).toBe(true);
    });

    it('ignores program and source overrides', async () => {
      const { resolver, spies } = createResolver({});

      await resolver.channelMayPickSubtitles('ch-1');

      expect(spies.program).not.toHaveBeenCalled();
      expect(spies.filler).not.toHaveBeenCalled();
    });
  });
});
