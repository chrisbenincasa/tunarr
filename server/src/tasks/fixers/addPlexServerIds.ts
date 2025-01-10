import { getDatabase } from '@/db/DBAccess.js';
import { MediaSourceType } from '@/db/schema/MediaSource.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { KEYS } from '@/types/inject.js';
import { Logger } from '@/util/logging/LoggerFactory.js';
import { inject, injectable } from 'inversify';
import { find, isNil } from 'lodash-es';
import Fixer from './fixer.js';

@injectable()
export class AddPlexServerIdsFixer extends Fixer {
  constructor(@inject(KEYS.Logger) protected logger: Logger) {
    super();
  }

  async runInternal(): Promise<void> {
    const plexServers = await getDatabase()
      .selectFrom('mediaSource')
      .selectAll()
      .where('clientIdentifier', 'is', null)
      .where('type', '=', MediaSourceType.Plex)
      .execute();
    for (const server of plexServers) {
      const api = MediaSourceApiFactory().get(server);
      const devices = await api.getDevices();
      if (!isNil(devices) && devices.MediaContainer.Device) {
        const matchingServer = find(
          devices.MediaContainer.Device,
          (d) => d.provides.includes('server') && d.name === server.name,
        );
        if (matchingServer) {
          await getDatabase()
            .updateTable('mediaSource')
            .set({
              clientIdentifier: matchingServer.clientIdentifier,
            })
            .where('uuid', '=', server.uuid)
            .limit(1)
            .executeTakeFirst();
        }
      }
    }
  }
}
