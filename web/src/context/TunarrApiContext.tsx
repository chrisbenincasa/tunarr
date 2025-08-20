import { type QueryClient } from '@tanstack/react-query';
import { isUndefined } from 'lodash-es';
import { type ReactNode, createContext, useEffect } from 'react';
import { client } from '../generated/client.gen.ts';
import { createClient } from '../generated/client/client.gen.ts';
import useStore from '../store/index.ts';
import { useSettings } from '../store/settings/selectors.ts';

// HACK ALERT
// Read zustand state out-of-band here (i.e. not in a hook) because we
// need the value available earlier than any components load. This is
// sort of hacky and really just a consequence of the fact that we're
// using react-router's preloaders to fetch data. These preloaders
// do not have access to the normal hook structure and they're overall
// pretty hacky to begin with. A better solution would be to utilize
// suspend queries with react-query, most likely.
let apiClient = createClient({
  baseURL: useStore.getState().settings.backendUri,
});
console.log(apiClient.getConfig());
// Gotta be careful using this... we're only exposing this
// for the preloaders. All other usages should come from the
// context API and related hooks.
// eslint-disable-next-line react-refresh/only-export-components
export const getApiClient = () => apiClient;

// eslint-disable-next-line react-refresh/only-export-components
export const TunarrApiContext = createContext(apiClient);

export function TunarrApiProvider({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  const { backendUri } = useSettings();

  useEffect(() => {
    // Only do this if something actually changed
    if (
      (backendUri.length === 0 &&
        !isUndefined(apiClient.getConfig().baseURL)) ||
      (backendUri.length > 0 && isUndefined(apiClient.getConfig().baseURL))
    ) {
      apiClient = createClient({ baseURL: backendUri });
      client.setConfig({ baseURL: backendUri });
    }
  }, [backendUri]);

  useEffect(() => {
    queryClient.invalidateQueries().catch(console.warn);
  }, [backendUri, queryClient]);

  return (
    <TunarrApiContext.Provider value={apiClient}>
      {children}
    </TunarrApiContext.Provider>
  );
}
