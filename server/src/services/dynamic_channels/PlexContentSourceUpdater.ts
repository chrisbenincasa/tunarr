import { Loaded } from '@mikro-orm/core';
import { buildPlexFilterKey } from '@tunarr/shared/util';
import {
  PlexLibraryMovies,
  PlexLibraryMusic,
  PlexLibraryShows,
} from '@tunarr/types/plex';
import { ChannelDB } from '../../dao/channelDb.js';
import { EntityManager } from '../../dao/dataSource.js';
import { DynamicContentConfigPlexSource } from '../../dao/derived_types/Lineup.js';
import { Channel } from '../../dao/entities/Channel.js';
import { PlexServerSettings } from '../../dao/entities/PlexServerSettings.js';
import { Plex } from '../../plex.js';
import { ContentSourceUpdater } from './ContentSourceUpdater.js';

export class PlexContentSourceUpdater extends ContentSourceUpdater<DynamicContentConfigPlexSource> {
  #plex: Plex;
  #channelDb: ChannelDB;

  constructor(
    channel: Loaded<Channel>,
    config: DynamicContentConfigPlexSource,
  ) {
    super(channel, config);
    this.#channelDb = new ChannelDB();
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
    const filter = buildPlexFilterKey(this.config.query?.search.filter);
    console.log(filter);

    // TODO page through the results
    const plexResult = await this.#plex.doGet<
      PlexLibraryMovies | PlexLibraryShows | PlexLibraryMusic
    >(
      `/library/sections/${
        this.config.query?.libraryKey ?? ''
      }/all?${filter.join('&')}`,
    );

    console.log(this.channel, plexResult?.size);
  }
}
