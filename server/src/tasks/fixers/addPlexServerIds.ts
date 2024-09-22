import { find, isNil } from 'lodash-es';
import { getEm } from '../../dao/dataSource.js';
import {
  MediaSource,
  MediaSourceType,
} from '../../dao/entities/MediaSource.js';
import { PlexApiClient } from '../../external/plex/PlexApiClient.js';
import Fixer from './fixer.js';

export class AddPlexServerIdsFixer extends Fixer {
  async runInternal(): Promise<void> {
    const em = getEm();
    const plexServers = await em
      .repo(MediaSource)
      .find({ clientIdentifier: null, type: MediaSourceType.Plex });

    for (const server of plexServers) {
      const api = new PlexApiClient(server);
      const devices = await api.getDevices();
      if (!isNil(devices) && devices.MediaContainer.Device) {
        const matchingServer = find(
          devices.MediaContainer.Device,
          (d) => d.provides.includes('server') && d.name === server.name,
        );
        if (matchingServer) {
          server.clientIdentifier = matchingServer.clientIdentifier;
          em.persist(server);
        }
      }
    }

    await em.flush();
  }
}
