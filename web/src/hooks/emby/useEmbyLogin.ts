import { postApiEmbyLogin } from '../../generated/sdk.gen.ts';

type Opts = {
  uri: string;
  username: string;
  password: string;
};

export const embyLogin = (opts: Opts) => {
  return postApiEmbyLogin({
    body: {
      ...opts,
      url: opts.uri,
    },
    throwOnError: true,
  }).then(({ data }) => data);
};
