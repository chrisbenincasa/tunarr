import { getDatabase } from '@/db/DBAccess.ts';
import { MediaSourceType } from '@/db/schema/MediaSource.ts';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.ts';
import { find, isNil } from 'lodash-es';
import Fixer from './fixer.js';

export class AddPlexServerIdsFixer extends Fixer {
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
