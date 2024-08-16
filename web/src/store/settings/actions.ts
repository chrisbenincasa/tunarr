import useStore from '..';

export const setBackendUri = (uri: string) =>
  useStore.setState(({ settings }) => {
    settings.backendUri = uri;
  });

export const setChannelTableColumnModel = (model: Record<string, boolean>) => {
  useStore.setState(({ settings }) => {
    settings.ui.channelTableColumnModel = { ...model };
  });
};
