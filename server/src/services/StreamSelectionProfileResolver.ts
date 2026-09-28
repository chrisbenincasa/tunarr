import type {
  StreamSelectionLevel,
  StreamSelectionProfile,
} from '@tunarr/types/schemas';
import { BuiltInStreamSelectionProfileId } from '@tunarr/types/schemas';
import { eq } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import type { ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import { Channel } from '../db/schema/Channel.ts';
import { CustomShow } from '../db/schema/CustomShow.ts';
import { FillerShow } from '../db/schema/FillerShow.ts';
import type { DrizzleDBAccess } from '../db/schema/index.ts';
import { Program } from '../db/schema/Program.ts';
import { StreamSelectionProfile as StreamSelectionProfileTable } from '../db/schema/StreamSelectionProfile.ts';
import { KEYS } from '../types/inject.ts';
import { InjectLogger } from '../util/inject.ts';
import type { Logger } from '../util/logging/LoggerFactory.ts';

export type StreamSelectionContext = {
  channelId: string;
  programId?: string;
  fillerListId?: string;
  customShowId?: string;
};

export type ResolvedStreamSelectionProfile = {
  level: StreamSelectionLevel;
  // The ID of the entity the profile was assigned to (program, custom show,
  // filler list, or channel). Undefined for the default and built-in levels.
  sourceId?: string;
  profile: StreamSelectionProfile;
};

// Used only if the seeded built-in row is missing from the database, so that
// the resolution chain always ends with a profile that matches.
export const BuiltInStreamSelectionProfile: StreamSelectionProfile = {
  uuid: BuiltInStreamSelectionProfileId,
  name: 'Tunarr Default',
  locked: true,
  rules: [
    {
      label: 'Default',
      condition: 'true',
      audioAction: { type: 'default' },
      subtitleAction: { type: 'disable' },
    },
  ],
};

const profileColumns = {
  uuid: StreamSelectionProfileTable.uuid,
  name: StreamSelectionProfileTable.name,
  rules: StreamSelectionProfileTable.rules,
  locked: StreamSelectionProfileTable.locked,
};

@injectable()
export class StreamSelectionProfileResolver {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(KEYS.DrizzleDB) private drizzle: DrizzleDBAccess,
    @inject(KEYS.SettingsDB) private settingsDB: ISettingsDB,
  ) {}

  /**
   * Returns every profile that applies to the context, from most to least
   * specific: program → source (custom show or filler list) → channel →
   * default → built-in. The evaluator walks this chain and stops at the
   * first profile with a matching rule. A profile appears at most once, at
   * its most specific level.
   */
  async resolveChain(
    ctx: StreamSelectionContext,
  ): Promise<ResolvedStreamSelectionProfile[]> {
    const chain: ResolvedStreamSelectionProfile[] = [];
    const seen = new Set<string>();
    const push = (
      level: StreamSelectionLevel,
      profile: StreamSelectionProfile | undefined,
      sourceId?: string,
    ) => {
      if (!profile || seen.has(profile.uuid)) {
        return;
      }
      seen.add(profile.uuid);
      chain.push({ level, sourceId, profile });
    };

    if (ctx.programId) {
      push(
        'program',
        await this.getProfileForProgram(ctx.programId),
        ctx.programId,
      );
    }

    // Custom shows and filler lists form a single "source" level. An item
    // is scheduled from one or the other, never both.
    if (ctx.fillerListId && ctx.customShowId) {
      this.logger.warn(
        'Stream selection context has both a filler list (%s) and a custom show (%s); using the filler list',
        ctx.fillerListId,
        ctx.customShowId,
      );
    }

    if (ctx.fillerListId) {
      push(
        'filler',
        await this.getProfileForFillerList(ctx.fillerListId),
        ctx.fillerListId,
      );
    } else if (ctx.customShowId) {
      push(
        'custom_show',
        await this.getProfileForCustomShow(ctx.customShowId),
        ctx.customShowId,
      );
    }

    push(
      'channel',
      await this.getProfileForChannel(ctx.channelId),
      ctx.channelId,
    );

    const defaultProfileId =
      this.settingsDB.streamSelectionSettings().defaultProfileId;
    if (defaultProfileId !== BuiltInStreamSelectionProfileId) {
      const defaultProfile = await this.getProfileById(defaultProfileId);
      if (!defaultProfile) {
        this.logger.warn(
          'Default stream selection profile %s does not exist; falling back to the built-in profile',
          defaultProfileId,
        );
      }
      push('default', defaultProfile);
    }

    push(
      'built_in',
      (await this.getProfileById(BuiltInStreamSelectionProfileId)) ??
        BuiltInStreamSelectionProfile,
    );

    return chain;
  }

  /**
   * Whether any channel-wide profile (channel → default → built-in) could
   * select a subtitle. Program and source overrides are not considered.
   * Used to decide whether subtitles are worth preparing ahead of time.
   */
  async channelMayPickSubtitles(channelId: string): Promise<boolean> {
    const chain = await this.resolveChain({ channelId });
    return chain.some(({ profile }) =>
      profile.rules.some((rule) => rule.subtitleAction.type !== 'disable'),
    );
  }

  private async getProfileById(
    id: string,
  ): Promise<StreamSelectionProfile | undefined> {
    const [result] = await this.drizzle
      .select(profileColumns)
      .from(StreamSelectionProfileTable)
      .where(eq(StreamSelectionProfileTable.uuid, id))
      .limit(1);
    return result;
  }

  private async getProfileForProgram(
    programId: string,
  ): Promise<StreamSelectionProfile | undefined> {
    const [result] = await this.drizzle
      .select(profileColumns)
      .from(Program)
      .innerJoin(
        StreamSelectionProfileTable,
        eq(Program.streamSelectionProfileId, StreamSelectionProfileTable.uuid),
      )
      .where(eq(Program.uuid, programId))
      .limit(1);
    return result;
  }

  private async getProfileForCustomShow(
    customShowId: string,
  ): Promise<StreamSelectionProfile | undefined> {
    const [result] = await this.drizzle
      .select(profileColumns)
      .from(CustomShow)
      .innerJoin(
        StreamSelectionProfileTable,
        eq(
          CustomShow.streamSelectionProfileId,
          StreamSelectionProfileTable.uuid,
        ),
      )
      .where(eq(CustomShow.uuid, customShowId))
      .limit(1);
    return result;
  }

  private async getProfileForFillerList(
    fillerListId: string,
  ): Promise<StreamSelectionProfile | undefined> {
    const [result] = await this.drizzle
      .select(profileColumns)
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
    return result;
  }

  private async getProfileForChannel(
    channelId: string,
  ): Promise<StreamSelectionProfile | undefined> {
    const [result] = await this.drizzle
      .select(profileColumns)
      .from(Channel)
      .innerJoin(
        StreamSelectionProfileTable,
        eq(Channel.streamSelectionProfileId, StreamSelectionProfileTable.uuid),
      )
      .where(eq(Channel.uuid, channelId))
      .limit(1);
    return result;
  }
}
