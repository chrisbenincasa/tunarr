import { setCurrentLineup } from '../../store/channelEditor/actions.ts';

export const useRemoveAllProgramming = () => {
  return () => {
    setCurrentLineup([], true);
  };
};
