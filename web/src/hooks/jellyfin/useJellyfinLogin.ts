import { isNonEmptyString } from '@/helpers/util.ts';
import { useQuery } from '@tanstack/react-query';
import { jellyfinLoginOptions } from '../../generated/@tanstack/react-query.gen.ts';
import { jellyfinLogin as apiJellyfinLogin } from '../../generated/sdk.gen.ts';

type Opts = {
  uri: string;
  username: string;
  password: string;
};

export const jellyfinLogin = async (opts: Opts) => {
  const result = await apiJellyfinLogin({
    body: {
      ...opts,
      url: opts.uri,
    },
    throwOnError: true,
  });
  return result.data;
};

export const useJellyinLogin = (opts: Opts, enabled: boolean = true) => {
  return useQuery({
    ...jellyfinLoginOptions({
      body: { url: opts.uri, password: opts.password, username: opts.username },
    }),
    enabled:
      enabled &&
      isNonEmptyString(opts.uri) &&
      isNonEmptyString(opts.username) &&
      isNonEmptyString(opts.password),
    retry: false,
    refetchOnWindowFocus: false,
  });
};
