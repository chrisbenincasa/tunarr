import { ChannelDB } from '@/db/ChannelDB.ts';
import { ProgramDB } from '@/db/ProgramDB.ts';
import { PendingProgram } from '@/db/derived_types/Lineup.ts';
import { MediaSourceDB } from '@/db/mediaSourceDB.ts';
import { Channel } from '@/db/schema/Channel.ts';
import { PlexApiClient } from '@/external/plex/PlexApiClient.js';
import { Logger, LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { Timer } from '@/util/perf.js';
import { createExternalId } from '@tunarr/shared';
import { buildPlexFilterKey } from '@tunarr/shared/util';
import { ContentProgram } from '@tunarr/types';
import { DynamicContentConfigPlexSource } from '@tunarr/types/api';
import { PlexLibraryListing } from '@tunarr/types/plex';
import { isNil, map } from 'lodash-es';
import {
  EnrichedPlexTerminalMedia,
  PlexItemEnumerator,
} from '../PlexItemEnumerator.js';
import { ContentSourceUpdater } from './ContentSourceUpdater.js';

export class PlexContentSourceUpdater extends ContentSourceUpdater<DynamicContentConfigPlexSource> {
  #logger: Logger = LoggerFactory.child({
    className: PlexContentSourceUpdater.name,
  });
  #timer = new Timer(this.#logger);
  #plex: PlexApiClient;
  #channelDB: ChannelDB;
  #programDB: ProgramDB;
  #mediaSourceDB: MediaSourceDB;

  constructor(channel: Channel, config: DynamicContentConfigPlexSource) {
    super(channel, config);
    this.#channelDB = new ChannelDB();
    this.#programDB = new ProgramDB();
    this.#mediaSourceDB = new MediaSourceDB(this.#channelDB);
  }

  protected async prepare() {
    const server = await this.#mediaSourceDB.findByType(
      'plex',
      this.config.plexServerId,
    );
    if (!server) {
      throw new Error('media source not found');
    }

    this.#plex = new PlexApiClient(server);
  }

  protected async run() {
    const filter = buildPlexFilterKey(this.config.search?.filter);

    // TODO page through the results
    const plexResult = await this.#timer.timeAsync('plex search', () =>
      this.#plex.doGetPath<PlexLibraryListing>(
        `/library/sections/${this.config.plexLibraryKey}/all?${filter.join(
          '&',
        )}`,
      ),
    );

    const enumerator = new PlexItemEnumerator(this.#plex, new ProgramDB());

    const enumeratedItems = await this.#timer.timeAsync('enumerate items', () =>
      enumerator.enumerateItems(plexResult?.Metadata ?? []),
    );

    const channelPrograms: ContentProgram[] = map(enumeratedItems, (media) => {
      return plexMediaToContentProgram(this.#plex.serverName, media);
    });

    const dbPrograms =
      await this.#programDB.upsertContentPrograms(channelPrograms);

    const now = new Date().getTime();

    const pendingPrograms: PendingProgram[] = map(dbPrograms, (program) => ({
      type: 'content' as const,
      id: program.uuid,
      durationMs: program.duration,
      updaterId: this.config.updater._id,
      addedAt: now,
    }));

    await this.#channelDB.addPendingPrograms(
      this.channel.uuid,
      pendingPrograms,
    );
  }
}

// TODO: duplicated from web - move to common
const plexMediaToContentProgram = (
  serverName: string,
  media: EnrichedPlexTerminalMedia,
): ContentProgram => {
  const uniqueId = createExternalId('plex', serverName, media.ratingKey);
  return {
    id: media.id ?? uniqueId,
    persisted: !isNil(media.id),
    originalProgram: { sourceType: 'plex', program: media },
    duration: media.duration ?? 0,
    externalSourceName: serverName,
    externalSourceType: 'plex',
    externalKey: media.ratingKey,
    uniqueId,
    type: 'content',
    subtype: media.type,
    title:
      media.type === 'episode'
        ? media.grandparentTitle ?? media.title
        : media.title,
    episodeTitle: media.type === 'episode' ? media.title : undefined,
    episodeNumber: media.type === 'episode' ? media.index : undefined,
    seasonNumber: media.type === 'episode' ? media.parentIndex : undefined,
    artistName: media.type === 'track' ? media.grandparentTitle : undefined,
    albumName: media.type === 'track' ? media.parentTitle : undefined,
    // showId:
    //   media.showId ??
    //   (media.type === 'episode'
    //     ? createExternalId('plex', serverName, media.grandparentRatingKey)
    //     : undefined),
    // seasonId:
    //   media.seasonId ??
    //   (media.type === 'episode'
    //     ? createExternalId('plex', serverName, media.parentRatingKey)
    //     : undefined),
    externalIds: [
      {
        type: 'multi',
        source: 'plex',
        sourceId: serverName,
        id: media.ratingKey,
      },
    ],
  };
};
