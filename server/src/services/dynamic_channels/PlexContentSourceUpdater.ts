import type { PendingProgram } from '@/db/derived_types/Lineup.js';
import type { MediaSourceDB } from '@/db/mediaSourceDB.js';
import type { Channel } from '@/db/schema/Channel.js';
import type { MediaSource } from '@/db/schema/MediaSource.js';
import type { PlexApiClient } from '@/external/plex/PlexApiClient.js';
import { Timer } from '@/util/Timer.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { ApiProgramMinter } from '@tunarr/shared';
import { buildPlexFilterKey } from '@tunarr/shared/util';
import type { ContentProgram } from '@tunarr/types';
import type { DynamicContentConfigPlexSource } from '@tunarr/types/api';
import type { PlexLibraryListing } from '@tunarr/types/plex';
import { map } from 'lodash-es';
import type { IChannelDB } from '../../db/interfaces/IChannelDB.js';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.js';
import { PlexItemEnumerator } from '../PlexItemEnumerator.js';
import { ContentSourceUpdater } from './ContentSourceUpdater.js';

export class PlexContentSourceUpdater extends ContentSourceUpdater<DynamicContentConfigPlexSource> {
  #logger: Logger = LoggerFactory.child({
    className: PlexContentSourceUpdater.name,
  });
  #timer = new Timer(this.#logger);
  #plex: PlexApiClient;
  #mediaSource: MediaSource;

  constructor(
    private channelDB: IChannelDB,
    private programDB: IProgramDB,
    private mediaSourceDB: MediaSourceDB,
    channel: Channel,
    config: DynamicContentConfigPlexSource,
  ) {
    super(channel, config);
  }

  protected async prepare() {
    const server = await this.mediaSourceDB.findByType(
      'plex',
      this.config.plexServerId,
    );

    if (!server) {
      throw new Error('media source not found');
    }

    this.#mediaSource = server;
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

    const enumerator = new PlexItemEnumerator(this.#plex, this.programDB);

    const enumeratedItems = await this.#timer.timeAsync('enumerate items', () =>
      enumerator.enumerateItems(plexResult?.Metadata ?? []),
    );

    const channelPrograms: ContentProgram[] = map(enumeratedItems, (media) => {
      return ApiProgramMinter.mintProgram(
        { id: this.#mediaSource.uuid, name: this.#mediaSource.name },
        { program: media, sourceType: 'plex' },
      );
    });

    const dbPrograms =
      await this.programDB.upsertContentPrograms(channelPrograms);

    const now = new Date().getTime();

    const pendingPrograms: PendingProgram[] = map(dbPrograms, (program) => ({
      type: 'content' as const,
      id: program.uuid,
      durationMs: program.duration,
      updaterId: this.config.updater._id,
      addedAt: now,
    }));

    await this.channelDB.addPendingPrograms(this.channel.uuid, pendingPrograms);
  }
}
