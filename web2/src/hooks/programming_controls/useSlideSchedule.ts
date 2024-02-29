import { setChannelStartTime } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';

const useSlide = () => {
  const channel = useStore(({ channelEditor }) => channelEditor.currentEntity);
  const programs = useStore(materializedProgramListSelector);
  return (amount: number) => {
    if (channel && amount !== 0 && programs.length > 0) {
      setChannelStartTime(channel.startTime + amount);
    }
  };
};

export const useFastForwardSchedule = () => {
  const slide = useSlide();
  return (amount: number) => slide(amount < 0 ? amount : -amount);
};

export const useRewindSchedule = () => {
  const slide = useSlide();
  return (amount: number) => slide(Math.abs(amount));
};
