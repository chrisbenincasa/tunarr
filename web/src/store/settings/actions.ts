import useStore from '..';
import { ProgramListDisplayOptions } from './store';

export const setBackendUri = (uri: string) =>
  useStore.setState(({ settings }) => {
    settings.backendUri = uri;
  });

export const setChannelTableColumnModel = (model: Record<string, boolean>) => {
  useStore.setState(({ settings }) => {
    settings.ui.channelTableColumnModel = { ...model };
  });
};

export const updateProgramListDisplayOptions = (
  fn: (prev: ProgramListDisplayOptions) => void,
) =>
  useStore.setState(
    ({
      settings: {
        ui: { programListDisplayOptions },
      },
    }) => {
      fn(programListDisplayOptions);
    },
  );
