import { isNonEmptyString } from '@/helpers/util.ts';
import { useApiQuery } from '../useApiQuery.ts';
import { ApiClient } from '@/external/api.ts';

type Opts = {
  url: string;
  username: string;
  password: string;
};

export const jellyfinLogin = (apiClient: ApiClient, opts: Opts) => {
  return apiClient.jellyfinUserLogin({
    ...opts,
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
      isNonEmptyString(opts.url) &&
      isNonEmptyString(opts.username) &&
      isNonEmptyString(opts.password),
  });
};
