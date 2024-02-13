import { compact, partition } from 'lodash-es';
import { AsyncInterval } from './AsyncInterval.ts';
import { sequentialPromises } from './util.ts';
import { apiClient } from '../external/api.ts';

const PlexLoginHeaders = {
  Accept: 'application/json',
  'X-Plex-Product': 'dizqueTV',
  'X-Plex-Version': 'Plex OAuth',
  'X-Plex-Client-Identifier': 'rg14zekk3pa5zp4safjwaa8z',
  'X-Plex-Model': 'Plex OAuth',
};

type PlexPinsResponse = {
  authToken: string | null;
  clientIdentifier: string;
  code: string;
  createdAt: string;
  expiresAt: string;
  expiresIn: number;
  id: number;
  product: string;
  qr: string;
  trusted: boolean;
};

type PlexConnection = {
  IPv6: boolean;
  address: string;
  local: boolean;
  port: number;
  protocol: string;
  relay: boolean;
  uri: string;
};

type PlexResourcesResponse = {
  accessToken: string;
  clientIdentifier: string;
  connections: PlexConnection[];
  createdAt: string;
  device: string;
  dnsRebindingProtection: boolean;
  home: boolean;
  httpsRequired: boolean;
  lastSeenAt: string;
  name: string;
  owned: boolean;
  ownerId: string | null;
  platform: string;
  platformVersion: string;
  presence: boolean;
  product: string;
  productVersion: string;
  provides: string;
  publicAddress: string;
  publicAddressMatches: boolean;
  relay: boolean;
  sourceTitle: string | null;
  synced: boolean;
};

export const plexLoginFlow = async () => {
  const request = new Request('https://plex.tv/api/v2/pins?strong=true', {
    method: 'POST',
    headers: new Headers(PlexLoginHeaders),
  });

  const initialResponse = await fetch(request);
  const initialResponseBody =
    (await initialResponse.json()) as PlexPinsResponse;

  console.log(initialResponseBody);

  const plexWindowSizes = {
    width: 800,
    height: 700,
  };

  const plexWindowPosition = {
    width: window.innerWidth / 2 + plexWindowSizes.width,
    height: window.innerHeight / 2 - plexWindowSizes.height,
  };

  const authWindow = window.open(
    `https://app.plex.tv/auth/#!?clientID=rg14zekk3pa5zp4safjwaa8z&context[device][version]=Plex OAuth&context[device][model]=Plex OAuth&code=${initialResponseBody.code}&context[device][product]=Plex Web`,
    '_blank',
    `height=${plexWindowSizes.height}, width=${plexWindowSizes.width}, top=${plexWindowPosition.height}, left=${plexWindowPosition.width}`,
  );

  const authTokenPromise = new Promise<string>((resolve, reject) => {
    const maxAttempts = 60;
    let attempts = 0;

    const intervalFn = async (interval: AsyncInterval) => {
      attempts++;
      if (attempts > maxAttempts) {
        interval.stop();
        authWindow?.close();
        reject();
        return;
      }

      if (authWindow && authWindow.closed) {
        reject();
        interval.stop();
        return;
      }

      try {
        const pins = await fetch(
          `https://plex.tv/api/v2/pins/${initialResponseBody.id}`,
          {
            headers: PlexLoginHeaders,
          },
        );
        const pinResponse = (await pins.json()) as PlexPinsResponse;

        if (pinResponse.authToken) {
          interval.stop();
          authWindow?.close();
          resolve(pinResponse.authToken);
          return;
        }
      } catch (e) {
        interval.stop();
        reject(e);
      }
    };

    const interval = new AsyncInterval(intervalFn, 2000);
    interval.start();
  });

  const authToken = await authTokenPromise;
  const serversResponse = await fetch(
    'https://plex.tv/api/v2/resources?includeHttps=1',
    {
      headers: {
        ...PlexLoginHeaders,
        'X-Plex-Token': authToken,
      },
    },
  ).then((res) => res.json() as Promise<PlexResourcesResponse[]>);

  return serversResponse.filter((server) => server.provides.includes('server'));
};

export const checkNewPlexServers = async (servers: PlexResourcesResponse[]) => {
  return sequentialPromises(servers, async (server) => {
    const [localConnections, remoteConnections] = partition(
      server.connections,
      (c) => c.local,
    );

    for (const connection of [...localConnections, ...remoteConnections]) {
      const { status } = await apiClient.getPlexBackendStatus({
        name: server.name,
        accessToken: server.accessToken,
        uri: connection.uri,
      });

      if (status === 1) {
        return { server, connection };
      }
    }
  }).then(compact);
};
