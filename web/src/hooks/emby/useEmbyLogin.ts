import { embyLogin as embyLoginApi } from '../../generated/sdk.gen.ts';

type Opts = {
  uri: string;
  username: string;
  password: string;
};

export const embyLogin = (opts: Opts) => {
  return embyLoginApi({
    body: {
      ...opts,
      url: opts.uri,
    },
    throwOnError: true,
  }).then(({ data }) => data);
};
