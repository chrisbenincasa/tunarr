import { StreamLineupItem } from '@/db/derived_types/StreamLineup.ts';
import { OutputFormat } from '@/ffmpeg/builder/constants.ts';
import { JellyfinProgramStreamFactory } from '@/stream/jellyfin/JellyfinProgramStream.ts';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { PlayerContext } from './PlayerStreamContext.ts';
import { ProgramStream } from './ProgramStream.ts';
import { ProgramStreamFactory } from './ProgramStreamFactory.ts';
import { PlexProgramStreamFactory } from './plex/PlexProgramStream.ts';

/**
 * Creates a {@link ProgramStream} baased on the given context
 */
export class ProgramStreamProvider {
  static #logger = LoggerFactory.child({
    className: ProgramStreamProvider.name,
  });

  logger = ProgramStreamProvider.#logger;

  constructor(
    // private db: Kysely<DB>,
    // private settingsDB: SettingsDB,
    // private mediaSourceDB: MediaSourceDB,
    private factoryByType: Map<StreamLineupItem['type'], ProgramStreamFactory>,
  ) {}

  create(context: PlayerContext, outputFormat: OutputFormat): ProgramStream {
    const factory = this.factoryByType.get(context.lineupItem.type);
    if (!factory) {
      throw new Error(
        `No program stream factory bound for type ${context.lineupItem.type}`,
      );
    }

    this.logger.debug('About to play %s stream', context.lineupItem.type);
    return factory.build(context, outputFormat);
  }
}

export class ContentBackedProgramStreamFactory implements ProgramStreamFactory {
  constructor(
    private plexProgramStreamFactory: PlexProgramStreamFactory,
    private jellyfinProgramStreamFactory: JellyfinProgramStreamFactory,
  ) {}

  build(context: PlayerContext, outputFormat: OutputFormat): ProgramStream {
    if (
      context.lineupItem.type !== 'program' &&
      context.lineupItem.type !== 'commercial'
    ) {
      throw new Error(
        'Unsupported lineup item type: ' + context.lineupItem.type,
      );
    }

    switch (context.lineupItem.externalSource) {
      case 'plex':
        return this.plexProgramStreamFactory.build(context, outputFormat);
      case 'jellyfin':
        return this.jellyfinProgramStreamFactory.build(context, outputFormat);
    }
  }
}
