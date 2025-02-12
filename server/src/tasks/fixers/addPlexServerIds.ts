import { MediaSourceType } from '@/db/schema/MediaSource.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { KEYS } from '@/types/inject.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { inject, injectable } from 'inversify';
import { Kysely } from 'kysely';
import { find, isNil } from 'lodash-es';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import { DB } from '../../db/schema/db.ts';
import Fixer from './fixer.js';

@injectable()
export class AddPlexServerIdsFixer extends Fixer {
  constructor(
    @inject(KEYS.Logger) protected logger: Logger,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
  ) {
    super();
  }

  async runInternal(): Promise<void> {
    const plexServers = await this.mediaSourceDB
      .findByType(MediaSourceType.Plex)
      .then((servers) => servers.filter((server) => !server.clientIdentifier));
    for (const server of plexServers) {
      const api =
        await this.mediaSourceApiFactory.getPlexApiClientForMediaSource(server);
      const devices = await api.getDevices();
      if (!isNil(devices) && devices.MediaContainer.Device) {
        const matchingServer = find(
          devices.MediaContainer.Device,
          (d) => d.provides.includes('server') && d.name === server.name,
        );
        if (matchingServer) {
          await this.db
            .updateTable('mediaSource')
            .set({
              clientIdentifier: matchingServer.clientIdentifier,
            })
            .where('uuid', '=', server.uuid)
            // TODO: Blocked on https://github.com/oven-sh/bun/issues/16909
            // .limit(1)
            .executeTakeFirst();
        }
      }
    }
  }
}
