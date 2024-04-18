import { PlexPinsResponse, PlexResourcesResponse } from '@tunarr/types/plex';
import { compact, partition } from 'lodash-es';
import { ApiClient } from '../external/api.ts';
import { AsyncInterval } from './AsyncInterval.ts';
import { sequentialPromises } from './util.ts';

// From Plex: The Client Identifier identifies the specific instance of your app. A random string or UUID is sufficient here. There are no hard requirements for Client Identifier length or format, but once one is generated the client should store and re-use this identifier for subsequent requests.
const ClientIdentifier = 'p86cy1w47clco3ro8t92nfy1';

const PlexLoginHeaders = {
  Accept: 'application/json',
  'X-Plex-Product': 'Tunarr',
  'X-Plex-Version': 'Plex OAuth',
  'X-Plex-Client-Identifier': ClientIdentifier,
  'X-Plex-Model': 'Plex OAuth',
};

export const plexLoginFlow = async () => {
  const request = new Request('https://plex.tv/api/v2/pins?strong=true', {
    method: 'POST',
    headers: new Headers(PlexLoginHeaders),
  });

  const initialResponse = await fetch(request);
  const initialResponseBody =
    (await initialResponse.json()) as PlexPinsResponse;

  const plexWindowSizes = {
    width: 800,
    height: 700,
  };

  const plexWindowPosition = {
    width: window.innerWidth / 2 + plexWindowSizes.width,
    height: window.innerHeight / 2 - plexWindowSizes.height,
  };

  const authWindow = window.open(
    `https://app.plex.tv/auth/#!?clientID=${ClientIdentifier}&context[device][version]=Plex OAuth&context[device][model]=Plex OAuth&code=${initialResponseBody.code}&context[device][product]=Plex Web`,
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
  ).then((res) => res.json() as Promise<PlexResourcesResponse>);

  return serversResponse.filter((server) => server.provides.includes('server'));
};

export const checkNewPlexServers =
  (apiClient: ApiClient) => async (servers: PlexResourcesResponse) => {
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
