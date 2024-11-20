import { SettingsDB, getSettings } from '@/db/SettingsDB.ts';
import { MediaSourceType } from '@/db/schema/MediaSource.ts';
import { OutputFormat } from '@/ffmpeg/builder/constants.ts';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { OfflineProgramStream } from './OfflinePlayer.js';
import { PlayerContext } from './PlayerStreamContext.js';
import { ProgramStream } from './ProgramStream.js';
import { JellyfinProgramStream } from './jellyfin/JellyfinProgramStream.js';
import { PlexProgramStream } from './plex/PlexProgramStream.js';

/**
 * Creates a {@link ProgramStream} baased on the given context
 */
export class ProgramStreamFactory {
  static #logger = LoggerFactory.child({
    className: ProgramStreamFactory.name,
  });

  static create(
    context: PlayerContext,
    outputFormat: OutputFormat,
    settingsDB: SettingsDB = getSettings(),
  ): ProgramStream {
    let streamType: string;
    let programStream: ProgramStream;
    switch (context.lineupItem.type) {
      case 'error':
        streamType = 'error';
        programStream = new OfflineProgramStream(
          true,
          context,
          outputFormat,
          settingsDB,
        );
        break;
      case 'loading':
        streamType = 'loading';
        programStream = new OfflineProgramStream(
          false,
          {
            ...context,
            isLoading: true,
          },
          outputFormat,
          settingsDB,
        );
        break;
      case 'offline':
        streamType = 'offline';
        programStream = new OfflineProgramStream(
          false,
          context,
          outputFormat,
          settingsDB,
        );
        break;
      case 'commercial':
      case 'program':
        switch (context.lineupItem.externalSource) {
          case MediaSourceType.Plex:
            streamType = 'plex';
            programStream = new PlexProgramStream(
              context,
              outputFormat,
              settingsDB,
            );
            break;
          case MediaSourceType.Jellyfin:
            streamType = 'jellyfin';
            programStream = new JellyfinProgramStream(
              context,
              outputFormat,
              settingsDB,
            );
        }
        break;
      case 'redirect':
        throw new Error('Impossible');
    }

    this.#logger.debug('About to play %s stream', streamType);
    return programStream;
  }
}
