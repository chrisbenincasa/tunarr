import { find, isNil } from 'lodash-es';
import { EntityManager } from '../../dao/dataSource.js';
import { PlexServerSettings } from '../../dao/entities/PlexServerSettings.js';
import { Plex } from '../../plex.js';
import Fixer from './fixer.js';

export class AddPlexServerIdsFixer extends Fixer {
  async runInternal(em: EntityManager): Promise<void> {
    const plexServers = await em
      .repo(PlexServerSettings)
      .find({ clientIdentifier: null });

    for (const server of plexServers) {
      const api = new Plex(server);
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
