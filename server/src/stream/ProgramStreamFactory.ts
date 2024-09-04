import { MediaSourceType } from '../dao/entities/MediaSource.js';
import { SettingsDB, getSettings } from '../dao/settings.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { OfflineProgramStream } from './OfflinePlayer.js';
import { PlayerContext } from './PlayerStreamContext.js';
import { ProgramStream } from './ProgramStream.js';
import { JellyfinProgramStreama } from './jellyfin/JellyfinProgramStream.js';
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
    settingsDB: SettingsDB = getSettings(),
  ): ProgramStream {
    let programStream: ProgramStream;
    switch (context.lineupItem.type) {
      case 'error':
        this.#logger.debug('About to play error stream');
        programStream = new OfflineProgramStream(true, context, settingsDB);
        break;
      case 'loading':
        this.#logger.debug('About to play loading stream');
        programStream = new OfflineProgramStream(
          false,
          {
            ...context,
            isLoading: true,
          },
          settingsDB,
        );
        break;
      case 'offline':
        this.#logger.debug('About to play offline stream');
        programStream = new OfflineProgramStream(false, context, settingsDB);
        break;
      case 'commercial':
      case 'program':
        switch (context.lineupItem.externalSource) {
          case MediaSourceType.Plex:
            this.#logger.debug('About to play plex stream');
            programStream = new PlexProgramStream(context, settingsDB);
            break;
          case MediaSourceType.Jellyfin:
            this.#logger.debug('About to play plex stream');
            programStream = new JellyfinProgramStreama(context, settingsDB);
        }
        break;
      case 'redirect':
        throw new Error('Impossible');
    }

    return programStream;
  }
}
