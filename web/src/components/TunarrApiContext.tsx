import { ReactNode, createContext, useEffect, useState } from 'react';
import { createApiClient } from '../external/api';
import { useSettings } from '../store/settings/selectors';
import { DefaultBackendUri } from '../store/settings/store';

let apiClient = createApiClient(DefaultBackendUri);

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
