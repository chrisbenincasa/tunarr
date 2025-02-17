import { type ApiClient } from '@/external/api.ts';
import { isNonEmptyString } from '@/helpers/util.ts';
import { useApiQuery } from '../useApiQuery.ts';

type Opts = {
  uri: string;
  username: string;
  password: string;
};

export const embyLogin = (apiClient: ApiClient, opts: Opts) => {
  return apiClient.embyUserLogin({
    ...opts,
    url: opts.uri,
  });
};

export const useEmbyLogin = (opts: Opts, enabled: boolean = true) => {
  return useApiQuery({
    queryKey: ['emby', 'login', opts],
    queryFn(apiClient) {
      return embyLogin(apiClient, opts);
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
