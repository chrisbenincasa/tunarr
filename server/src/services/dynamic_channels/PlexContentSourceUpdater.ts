import { Loaded } from '@mikro-orm/core';
import { createExternalId } from '@tunarr/shared';
import { buildPlexFilterKey } from '@tunarr/shared/util';
import { ContentProgram } from '@tunarr/types';
import { DynamicContentConfigPlexSource } from '@tunarr/types/api';
import { PlexLibraryListing } from '@tunarr/types/plex';
import { isNil, map } from 'lodash-es';
import { ChannelDB } from '../../dao/channelDb.js';
import { EntityManager } from '../../dao/dataSource.js';
import { Channel } from '../../dao/entities/Channel.js';
import { PlexServerSettings } from '../../dao/entities/PlexServerSettings.js';
import { ProgramDB } from '../../dao/programDB.js';
import { Plex } from '../../external/plex.js';
import { PlexItemEnumerator } from '../PlexItemEnumerator.js';
import { ContentSourceUpdater } from './ContentSourceUpdater.js';
import { createPlexExternalId } from '../../util/externalIds.js';

export class PlexContentSourceUpdater extends ContentSourceUpdater<DynamicContentConfigPlexSource> {
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
    const plexResult = await this.#plex.doGet<PlexLibraryListing>(
      `/library/sections/${this.config.plexLibraryKey}/all?${filter.join('&')}`,
    );

    const enumerator = new PlexItemEnumerator(this.#plex, new ProgramDB());

    const enumeratedItems = await enumerator.enumerateItems(
      plexResult?.Metadata ?? [],
    );

    const programs: ContentProgram[] = map(enumeratedItems, (media) => {
      const uniqueId = createExternalId(
        'plex',
        this.#plex.serverName,
        media.ratingKey,
      );
      return {
        id: media.id ?? uniqueId,
        persisted: !isNil(media.id),
        originalProgram: media,
        duration: media.duration,
        externalSourceName: this.#plex.serverName,
        externalSourceType: 'plex',
        externalKey: media.key,
        uniqueId: uniqueId,
        type: 'content',
        subtype: media.type,
        title: media.type === 'episode' ? media.grandparentTitle : media.title,
        episodeTitle: media.type === 'episode' ? media.title : undefined,
        episodeNumber: media.type === 'episode' ? media.index : undefined,
        seasonNumber: media.type === 'episode' ? media.parentIndex : undefined,
        externalIds: [
          createPlexExternalId(this.#plex.serverName, media.ratingKey),
        ],
      };
    });

    console.log(programs.length);

    await this.#channelDB.updateLineup(this.channel.uuid, {
      type: 'manual',
      lineup: [],
      programs: [],
    });
  }
}
