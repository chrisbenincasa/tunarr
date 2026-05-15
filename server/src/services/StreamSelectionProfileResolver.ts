import type {
  StreamSelectionProfile,
  StreamSelectionRule,
} from '@tunarr/types/schemas';
import { eq } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { orderBy } from 'lodash-es';
import type { IChannelDB } from '../db/interfaces/IChannelDB.ts';
import type { ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import { Channel } from '../db/schema/Channel.ts';
import { FillerShow } from '../db/schema/FillerShow.ts';
import type { DrizzleDBAccess } from '../db/schema/index.ts';
import { Program } from '../db/schema/Program.ts';
import { StreamSelectionProfile as StreamSelectionProfileTable } from '../db/schema/StreamSelectionProfile.ts';
import { KEYS } from '../types/inject.ts';
import { InjectLogger } from '../util/inject.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';

export type StreamSelectionContext = {
  channelId: string;
  programId?: string;
  fillerListId?: string;
  customShowId?: string;
};

@injectable()
export class StreamSelectionProfileResolver {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(KEYS.DrizzleDB) private drizzle: DrizzleDBAccess,
    @inject(KEYS.SettingsDB) private settingsDB: ISettingsDB,
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
  ) {}

  async resolve(ctx: StreamSelectionContext): Promise<StreamSelectionProfile> {
    // 1. Check program-level profile
    if (ctx.programId) {
      const profile = await this.getProfileForProgram(ctx.programId);
      if (profile) {
        this.logger.debug(
          'Resolved stream selection profile from program %s: %s',
          ctx.programId,
          profile.name,
        );
        return profile;
      }
    }

    // 2. Check filler list-level profile
    if (ctx.fillerListId) {
      const profile = await this.getProfileForFillerList(ctx.fillerListId);
      if (profile) {
        this.logger.debug(
          'Resolved stream selection profile from filler list %s: %s',
          ctx.fillerListId,
          profile.name,
        );
        return profile;
      }
    }

    // 3. Check channel-level profile
    const profile = await this.getProfileForChannel(ctx.channelId);
    if (profile) {
      this.logger.debug(
        'Resolved stream selection profile from channel %s: %s',
        ctx.channelId,
        profile.name,
      );
      return profile;
    }

    // 4. Legacy fallback
    this.logger.debug(
      'No stream selection profile found for channel %s, using legacy fallback',
      ctx.channelId,
    );
    return this.buildLegacyProfile(ctx.channelId);
  }

  private async getProfileForProgram(
    programId: string,
  ): Promise<StreamSelectionProfile | undefined> {
    const result = await this.drizzle
      .select({
        uuid: StreamSelectionProfileTable.uuid,
        name: StreamSelectionProfileTable.name,
        rules: StreamSelectionProfileTable.rules,
      })
      .from(Program)
      .innerJoin(
        StreamSelectionProfileTable,
        eq(Program.streamSelectionProfileId, StreamSelectionProfileTable.uuid),
      )
      .where(eq(Program.uuid, programId))
      .limit(1);

    if (result.length > 0) {
      return result[0] as StreamSelectionProfile;
    }
    return;
  }

  private async getProfileForFillerList(
    fillerListId: string,
  ): Promise<StreamSelectionProfile | undefined> {
    const result = await this.drizzle
      .select({
        uuid: StreamSelectionProfileTable.uuid,
        name: StreamSelectionProfileTable.name,
        rules: StreamSelectionProfileTable.rules,
      })
      .from(FillerShow)
      .innerJoin(
        StreamSelectionProfileTable,
        eq(
          FillerShow.streamSelectionProfileId,
          StreamSelectionProfileTable.uuid,
        ),
      )
      .where(eq(FillerShow.uuid, fillerListId))
      .limit(1);

    if (result.length > 0) {
      return result[0] as StreamSelectionProfile;
    }
    return;
  }

  private async getProfileForChannel(
    channelId: string,
  ): Promise<StreamSelectionProfile | undefined> {
    const result = await this.drizzle
      .select({
        uuid: StreamSelectionProfileTable.uuid,
        name: StreamSelectionProfileTable.name,
        rules: StreamSelectionProfileTable.rules,
      })
      .from(Channel)
      .innerJoin(
        StreamSelectionProfileTable,
        eq(Channel.streamSelectionProfileId, StreamSelectionProfileTable.uuid),
      )
      .where(eq(Channel.uuid, channelId))
      .limit(1);

    if (result.length > 0) {
      return result[0] as StreamSelectionProfile;
    }
    return;
  }

  private async buildLegacyProfile(
    channelId: string,
  ): Promise<StreamSelectionProfile> {
    const rules: StreamSelectionRule[] = [];

    // Build audio action from ffmpeg language preferences
    const ffmpegSettings = this.settingsDB.ffmpegSettings();
    const langPrefs = ffmpegSettings.languagePreferences?.preferences ?? [];

    const audioAction =
      langPrefs.length > 0
        ? {
            type: 'by_language' as const,
            languages: langPrefs.map((p) => p.iso6392),
          }
        : { type: 'default' as const };

    // Check if the channel has subtitles enabled
    const channel = await this.channelDB.getChannel(channelId);

    let subtitleAction: StreamSelectionRule['subtitleAction'];
    if (!channel?.subtitlesEnabled) {
      subtitleAction = { type: 'disable' as const };
    } else {
      // Build subtitle action from channel subtitle preferences
      const subtitlePrefs =
        await this.channelDB.getChannelSubtitlePreferences(channelId);

      if (subtitlePrefs.length > 0) {
        const sorted = orderBy(subtitlePrefs, 'priority', 'asc');
        const topPref = sorted[0]!;
        subtitleAction = {
          type: 'by_language' as const,
          languages: sorted.map((p) => p.languageCode),
          filterType: topPref.filterType ?? 'any',
          allowImageBased: Boolean(topPref.allowImageBased ?? true),
          allowExternal: Boolean(topPref.allowExternal ?? true),
        };
      } else {
        subtitleAction = { type: 'default' as const };
      }
    }

    rules.push({
      label: 'Legacy fallback',
      condition: 'true',
      audioAction,
      subtitleAction,
    });

    return {
      uuid: `legacy-${channelId}`,
      name: 'Legacy Settings',
      rules,
    };
  }
}
