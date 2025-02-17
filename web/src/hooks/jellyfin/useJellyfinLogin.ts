import { isNonEmptyString } from '@/helpers/util.ts';
import { useApiQuery } from '../useApiQuery.ts';
import { ApiClient } from '@/external/api.ts';

type Opts = {
  uri: string;
  username: string;
  password: string;
};

export const jellyfinLogin = (apiClient: ApiClient, opts: Opts) => {
  return apiClient.jellyfinUserLogin({
    ...opts,
    url: opts.uri,
  });
};

export const useJellyinLogin = (opts: Opts, enabled: boolean = true) => {
  return useApiQuery({
    queryKey: ['jellyfin', 'login', opts],
    queryFn(apiClient) {
      return jellyfinLogin(apiClient, opts);
    },
    enabled:
      enabled &&
      isNonEmptyString(opts.uri) &&
      isNonEmptyString(opts.username) &&
      isNonEmptyString(opts.password),
    retry: false,
    refetchOnWindowFocus: false,
  });
};
