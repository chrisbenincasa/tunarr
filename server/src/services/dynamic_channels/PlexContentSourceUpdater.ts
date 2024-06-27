import { Loaded } from '@mikro-orm/core';
import { createExternalId } from '@tunarr/shared';
import { buildPlexFilterKey } from '@tunarr/shared/util';
import { DynamicContentConfigPlexSource } from '@tunarr/types/api';
import { PlexLibraryListing } from '@tunarr/types/plex';
import { isNil, map } from 'lodash-es';
import { ChannelDB } from '../../dao/channelDb.js';
import { EntityManager } from '../../dao/dataSource.js';
import { Channel } from '../../dao/entities/Channel.js';
import { PlexServerSettings } from '../../dao/entities/PlexServerSettings.js';
import { ProgramDB } from '../../dao/programDB.js';
import { Plex } from '../../external/plex.js';
import {
  EnrichedPlexTerminalMedia,
  PlexItemEnumerator,
} from '../PlexItemEnumerator.js';
import { ContentSourceUpdater } from './ContentSourceUpdater.js';
import { upsertContentPrograms } from '../../dao/programHelpers.js';
import { ContentProgram } from '@tunarr/types';
import { PendingProgram } from '../../dao/derived_types/Lineup.js';
import { Logger, LoggerFactory } from '../../util/logging/LoggerFactory.js';
import { Timer } from '../../util/perf.js';

export class PlexContentSourceUpdater extends ContentSourceUpdater<DynamicContentConfigPlexSource> {
  #logger: Logger = LoggerFactory.child({
    className: PlexContentSourceUpdater.name,
  });
  #timer = new Timer(this.#logger);
  #plex: Plex;
  #channelDB: ChannelDB;

  constructor(
    channel: Loaded<Channel>,
    config: DynamicContentConfigPlexSource,
  ) {
    super(channel, config);
    this.#channelDB = new ChannelDB();
  }

  protected async prepare(em: EntityManager) {
    const server = await em.repo(PlexServerSettings).findOneOrFail({
      $or: [
        { name: this.config.plexServerId },
        { clientIdentifier: this.config.plexServerId },
      ],
    });

    this.#plex = new Plex(server);
  }

  protected async run() {
    const filter = buildPlexFilterKey(this.config.search?.filter);

    // TODO page through the results
    const plexResult = await this.#timer.timeAsync('plex search', () =>
      this.#plex.doGet<PlexLibraryListing>(
        `/library/sections/${this.config.plexLibraryKey}/all?${filter.join(
          '&',
        )}`,
      ),
    );

    console.log(filter.join('&'));

    const enumerator = new PlexItemEnumerator(this.#plex, new ProgramDB());

    const enumeratedItems = await this.#timer.timeAsync('enumerate items', () =>
      enumerator.enumerateItems(plexResult?.Metadata ?? []),
    );

    const channelPrograms: ContentProgram[] = map(enumeratedItems, (media) => {
      return plexMediaToContentProgram(this.#plex.serverName, media);
    });

    const dbPrograms = await upsertContentPrograms(channelPrograms);

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
    originalProgram: media,
    duration: media.duration,
    externalSourceName: serverName,
    externalSourceType: 'plex',
    externalKey: media.ratingKey,
    uniqueId,
    type: 'content',
    subtype: media.type,
    title: media.type === 'episode' ? media.grandparentTitle : media.title,
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
