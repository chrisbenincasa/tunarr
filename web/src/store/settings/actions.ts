import useStore from '..';

export const setBackendUri = (uri: string) =>
  useStore.setState(({ settings }) => {
    settings.backendUri = uri;
  });
