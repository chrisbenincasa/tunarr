import useStore from '..';

export const useSettings = () => {
  return useStore(({ settings }) => settings);
};
