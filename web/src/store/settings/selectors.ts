import { isEmpty, trimEnd } from 'lodash-es';
import useStore from '..';

export const useSettings = () => {
  return useStore(({ settings }) => settings);
};

export const useBackendUrl = () => {
  const { backendUri } = useSettings();
  return trimEnd(
    (isEmpty(backendUri) ? window.location.origin : backendUri).trim(),
    '/',
  );
};

export const useChannelTableVisibilityModel = () =>
  useStore(({ settings }) => settings.ui.channelTableColumnModel);
