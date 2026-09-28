import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import Fixer from '@/tasks/fixers/fixer.js';
import { KEYS } from '@/types/inject.js';
import { InjectLogger } from '@/util/inject.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import type {
  AudioAction,
  StreamSelectionRule,
  SubtitleAction,
} from '@tunarr/types/schemas';
import {
  BuiltInStreamSelectionProfileId,
  type SubtitleFilterSchema,
} from '@tunarr/types/schemas';
import { inArray } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { groupBy, isEqual, orderBy } from 'lodash-es';
import { v4 } from 'uuid';
import type { z } from 'zod/v4';
import { Channel } from '../../db/schema/Channel.ts';
import type { DrizzleDBAccess } from '../../db/schema/index.ts';
import { StreamSelectionProfile } from '../../db/schema/StreamSelectionProfile.ts';
import { ChannelSubtitlePreferences } from '../../db/schema/SubtitlePreferences.ts';

type LanguagePreference = { iso6392: string };

type SubtitleFilterType = z.infer<typeof SubtitleFilterSchema>;

type SubtitlePreference = {
  languageCode: string;
  priority: number;
  filterType: SubtitleFilterType;
  allowImageBased: boolean;
  allowExternal: boolean;
};

export function legacyAudioAction(
  languagePreferences: ReadonlyArray<LanguagePreference>,
): AudioAction {
  if (languagePreferences.length === 0) {
    return { type: 'default' };
  }
  return {
    type: 'by_language',
    languages: languagePreferences.map((p) => p.iso6392),
  };
}

/**
 * The subtitle action the legacy channel settings produced for a channel
 * with subtitles enabled.
 */
export function legacySubtitleAction(
  preferences: ReadonlyArray<SubtitlePreference>,
): SubtitleAction {
  // Preferences with filterType 'none' mean "don't match subtitles for this
  // language", matching the behavior of SubtitleStreamPicker.pickSubtitles.
  const active = orderBy(
    preferences.filter((p) => p.filterType !== 'none'),
    'priority',
    'asc',
  );
  const [top] = active;
  if (!top) {
    return { type: 'default', preferTextBased: false };
  }
  return {
    type: 'by_language',
    languages: active.map((p) => p.languageCode),
    filterType: top.filterType,
    allowImageBased: top.allowImageBased,
    allowExternal: top.allowExternal,
    preferTextBased: false,
  };
}

export function migratedProfileName(action: SubtitleAction): string {
  switch (action.type) {
    case 'by_language':
      return `Migrated: ${action.languages.join(', ')} subtitles`;
    case 'default':
      return 'Migrated: default subtitles';
    case 'disable':
      return 'Migrated Defaults';
  }
}

/**
 * Converts the legacy stream selection settings into profiles. Before
 * profiles, audio came from the global ffmpeg language preferences and
 * subtitles from each channel's subtitle toggle and preferences.
 *
 * - A "Migrated Defaults" profile holds the global audio preferences with
 *   subtitles disabled, and becomes the default profile.
 * - Each distinct subtitle configuration among channels with subtitles
 *   enabled becomes one profile, assigned to those channels.
 *
 * The legacy settings are left in place so the conversion can be re-run if
 * it needs fixing. Runs once; completion is recorded in the settings file.
 */
@injectable()
export class MigrateLegacyStreamSelection extends Fixer {
  @InjectLogger() declare protected readonly logger: Logger;

  constructor(
    @inject(KEYS.DrizzleDB) private drizzle: DrizzleDBAccess,
    @inject(KEYS.SettingsDB) private settingsDB: ISettingsDB,
  ) {
    super();
  }

  protected async runInternal(): Promise<void> {
    if (this.settingsDB.migrationState.hasMigratedLegacyStreamSelection) {
      return;
    }

    const channels = await this.drizzle
      .select({
        uuid: Channel.uuid,
        subtitlesEnabled: Channel.subtitlesEnabled,
        streamSelectionProfileId: Channel.streamSelectionProfileId,
      })
      .from(Channel);

    if (channels.length === 0) {
      await this.markDone();
      return;
    }

    const audioAction = legacyAudioAction(
      this.settingsDB.ffmpegSettings().languagePreferences?.preferences ?? [],
    );

    const subtitleChannelIds = channels
      .filter((c) => c.subtitlesEnabled && !c.streamSelectionProfileId)
      .map((c) => c.uuid);
    const subtitlePrefs =
      subtitleChannelIds.length > 0
        ? await this.drizzle
            .select()
            .from(ChannelSubtitlePreferences)
            .where(
              inArray(ChannelSubtitlePreferences.channelId, subtitleChannelIds),
            )
        : [];
    const prefsByChannel = groupBy(subtitlePrefs, (p) => p.channelId);

    // Group channels by the subtitle action their settings produce.
    const groups: { action: SubtitleAction; channelIds: string[] }[] = [];
    for (const channelId of subtitleChannelIds) {
      const action = legacySubtitleAction(prefsByChannel[channelId] ?? []);
      const group = groups.find((g) => isEqual(g.action, action));
      if (group) {
        group.channelIds.push(channelId);
      } else {
        groups.push({ action, channelIds: [channelId] });
      }
    }

    const now = new Date();
    const makeRule = (subtitleAction: SubtitleAction): StreamSelectionRule => ({
      label: 'Migrated settings',
      condition: 'true',
      audioAction,
      subtitleAction,
    });

    // Without audio preferences, the defaults profile would be identical to
    // the built-in one, so the built-in stays the default.
    const defaultsProfileId = audioAction.type === 'default' ? undefined : v4();

    this.drizzle.transaction((tx) => {
      if (defaultsProfileId) {
        tx.insert(StreamSelectionProfile)
          .values({
            uuid: defaultsProfileId,
            name: migratedProfileName({ type: 'disable' }),
            rules: [makeRule({ type: 'disable' })],
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }

      for (const { action, channelIds } of groups) {
        const uuid = v4();
        tx.insert(StreamSelectionProfile)
          .values({
            uuid,
            name: migratedProfileName(action),
            rules: [makeRule(action)],
            createdAt: now,
            updatedAt: now,
          })
          .run();
        tx.update(Channel)
          .set({ streamSelectionProfileId: uuid })
          .where(inArray(Channel.uuid, channelIds))
          .run();
      }
    });

    if (
      defaultsProfileId &&
      this.settingsDB.streamSelectionSettings().defaultProfileId ===
        BuiltInStreamSelectionProfileId
    ) {
      await this.settingsDB.updateSettings('streamSelection', {
        defaultProfileId: defaultsProfileId,
      });
    }

    this.logger.info(
      'Converted legacy language and subtitle settings into %d stream selection profile(s)',
      groups.length + (defaultsProfileId ? 1 : 0),
    );

    await this.markDone();
  }

  private async markDone() {
    await this.settingsDB.updateBaseSettings('migration', {
      hasMigratedLegacyStreamSelection: true,
    });
  }
}
