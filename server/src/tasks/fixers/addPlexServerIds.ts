import { find, isNil } from 'lodash-es';
import { directDbAccess } from '../../dao/direct/directDbAccess.js';
import { MediaSourceType } from '../../dao/entities/MediaSource.js';
import { PlexApiClient } from '../../external/plex/PlexApiClient.js';
import Fixer from './fixer.js';

export class AddPlexServerIdsFixer extends Fixer {
  async runInternal(): Promise<void> {
    const plexServers = await directDbAccess()
      .selectFrom('mediaSource')
      .selectAll()
      .where('clientIdentifier', 'is', null)
      .where('type', '=', MediaSourceType.Plex)
      .execute();
    for (const server of plexServers) {
      const api = new PlexApiClient(server);
      const devices = await api.getDevices();
      if (!isNil(devices) && devices.MediaContainer.Device) {
        const matchingServer = find(
          devices.MediaContainer.Device,
          (d) => d.provides.includes('server') && d.name === server.name,
        );
        if (matchingServer) {
          await directDbAccess()
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
