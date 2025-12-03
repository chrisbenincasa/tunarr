import type { PendingProgram } from '@/db/derived_types/Lineup.js';
import type { MediaSourceDB } from '@/db/mediaSourceDB.js';
import type { ChannelOrm } from '@/db/schema/Channel.js';
import type { PlexApiClient } from '@/external/plex/PlexApiClient.js';
import { Timer } from '@/util/Timer.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { ApiProgramMinter } from '@tunarr/shared';
import { buildPlexFilterKey, seq } from '@tunarr/shared/util';
import { tag, type ContentProgram } from '@tunarr/types';
import type { DynamicContentConfigPlexSource } from '@tunarr/types/api';
import { map } from 'lodash-es';
import type { IChannelDB } from '../../db/interfaces/IChannelDB.js';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.js';
import type { MediaSourceWithRelations } from '../../db/schema/derivedTypes.js';
import { PlexItemEnumerator } from '../PlexItemEnumerator.js';
import { ContentSourceUpdater } from './ContentSourceUpdater.js';

export class PlexContentSourceUpdater extends ContentSourceUpdater<DynamicContentConfigPlexSource> {
  #logger: Logger = LoggerFactory.child({
    className: PlexContentSourceUpdater.name,
  });
  #timer = new Timer(this.#logger);
  #plex: PlexApiClient;
  #mediaSource: MediaSourceWithRelations;

  constructor(
    private channelDB: IChannelDB,
    private programDB: IProgramDB,
    private mediaSourceDB: MediaSourceDB,
    channel: ChannelOrm,
    config: DynamicContentConfigPlexSource,
  ) {
    super(channel, config);
  }

  protected async prepare() {
    const server = await this.mediaSourceDB.findByType(
      'plex',
      tag(this.config.plexServerId),
    );

    if (!server) {
      throw new Error('media source not found');
    }

    this.#mediaSource = server;

    const library = this.#mediaSource.libraries.find(
      (lib) => lib.externalKey === this.config.plexLibraryKey,
    );
    if (!library) {
      throw new Error(
        `Library with external key = ${this.config.plexLibraryKey} not found. Try syncing libraries.`,
      );
    }
  }

  protected async run() {
    const filter = buildPlexFilterKey(this.config.search?.filter);

    // TODO page through the results
    const plexResult = await this.#timer.timeAsync('plex search', () =>
      this.#plex.search(
        this.config.plexLibraryKey,
        undefined,
        filter.join('&'),
        undefined,
      ),
    );

    const enumerator = new PlexItemEnumerator(this.#plex);

    const enumeratedItems = await this.#timer.timeAsync('enumerate items', () =>
      enumerator.enumerateItems(
        this.#mediaSource,
        plexResult.getOrThrow().result,
      ),
    );

    const channelPrograms: ContentProgram[] = seq.collect(
      enumeratedItems,
      (media) => {
        return ApiProgramMinter.mintProgram2(media);
      },
    );

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
