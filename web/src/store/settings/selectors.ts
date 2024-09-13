import useStore from '..';

export const useSettings = () => {
  return useStore(({ settings }) => settings);
};

export const useChannelTableVisibilityModel = () =>
  useStore(({ settings }) => settings.ui.channelTableColumnModel);

export const useProgramListDisplayOptions = () =>
  useStore(({ settings }) => settings.ui.programListDisplayOptions);
