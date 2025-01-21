import { ChannelDB } from '@/db/ChannelDB.js';
import { ProgramDB } from '@/db/ProgramDB.js';
import { PendingProgram } from '@/db/derived_types/Lineup.js';
import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import { Channel } from '@/db/schema/Channel.js';
import { MediaSource } from '@/db/schema/MediaSource.js';
import { PlexApiClient } from '@/external/plex/PlexApiClient.js';
import { Logger, LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { Timer } from '@/util/perf.js';
import { ApiProgramMinter } from '@tunarr/shared';
import { buildPlexFilterKey } from '@tunarr/shared/util';
import { ContentProgram } from '@tunarr/types';
import { DynamicContentConfigPlexSource } from '@tunarr/types/api';
import { PlexLibraryListing } from '@tunarr/types/plex';
import { map } from 'lodash-es';
import { PlexItemEnumerator } from '../PlexItemEnumerator.js';
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

  #mediaSource: MediaSource;

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

    const enumerator = new PlexItemEnumerator(this.#plex, new ProgramDB());

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
