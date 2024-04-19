import { ReactNode, createContext, useEffect, useState } from 'react';
import { createApiClient } from '../external/api';
import useStore from '../store/index.ts';
import { useSettings } from '../store/settings/selectors';

// HACK ALERT
// Read zustand state out-of-band here (i.e. not in a hook) because we
// need the value available earlier than any components load. This is
// sort of hacky and really just a consequence of the fact that we're
// using react-router's preloaders to fetch data. These preloaders
// do not have access to the normal hook structure and they're overall
// pretty hacky to begin with. A better solution would be to utilize
// suspend queries with react-query, most likely.
let apiClient = createApiClient(useStore.getState().settings.backendUri);

// Gotta be careful using this... we're only exposing this
// for the preloaders. All other usages should come from the
// context API and related hooks.
// eslint-disable-next-line react-refresh/only-export-components
export const getApiClient = () => apiClient;

export const TunarrApiContext = createContext(apiClient);

export function TunarrApiProvider({ children }: { children: ReactNode }) {
  const { backendUri } = useSettings();
  const [api, setApi] = useState(apiClient);

  useEffect(() => {
    apiClient = createApiClient(backendUri);
    setApi(apiClient);
  }, [backendUri]);

  return (
    <TunarrApiContext.Provider value={api}>
      {children}
    </TunarrApiContext.Provider>
  );
}
