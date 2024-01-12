import filter from 'lodash-es/filter';
import negate from 'lodash-es/negate';
import useStore from '../../store/index.ts';
import { Channel, ChannelProgram, isFlexProgram } from 'dizquetv-types';
import dayjs from 'dayjs';
import { forEach } from 'lodash-es';
import {
  setCurrentLineup,
  updateCurrentChannel,
} from '../../store/channelEditor/actions.ts';

export type StartTimePadding = {
  mod: number;
  description: string;
};

const OneMinuteMillis = 1000 * 60;

export const StartTimePaddingOptions: readonly StartTimePadding[] = [
  { mod: -1, description: 'None' },
  { mod: 15, description: ':00, :15, :30, :45' },
  { mod: 30, description: ':00, :30' },
] as const;

export function usePadStartTimes() {
  const channel = useStore((s) => s.channelEditor.currentChannel);
  const programs = useStore((s) => s.channelEditor.programList);

  return (padding: StartTimePadding | null) => {
    const { newStartTime, newProgramList } = padStartTimes(
      channel,
      programs,
      padding,
    );
    updateCurrentChannel({ startTime: newStartTime });
    setCurrentLineup(newProgramList, true);
  };
}

export function padStartTimes(
  channel: Channel | undefined,
  programs: ChannelProgram[],
  padding: StartTimePadding | null,
) {
  const mod =
    !padding || padding.mod <= 0 ? OneMinuteMillis : padding.mod * 60 * 1000;
  const startTime = dayjs(channel?.startTime).unix() * 1000;
  const newStartTime = startTime - (startTime % mod);
  const filteredPrograms = filter(programs, negate(isFlexProgram));

  let lastStartTime = newStartTime;
  const newProgramList: ChannelProgram[] = [];
  forEach(filteredPrograms, (program) => {
    newProgramList.push(program);
    const last = dayjs(lastStartTime);
    // How many "slots" of time does this program take up?
    // We find the next available start time for a program
    const nextProgramTime = last.add(
      Math.ceil(program.duration / mod) * mod,
      'milliseconds',
    );
    // Advance by the duration of the program
    lastStartTime += program.duration;
    // How much padding do we need?
    const paddingDuration = nextProgramTime.diff(lastStartTime);
    if (paddingDuration > 30 * 1000) {
      newProgramList.push({
        type: 'flex',
        duration: paddingDuration,
        persisted: false,
      });
      lastStartTime += paddingDuration;
    }
  });

  return { newStartTime, newProgramList };
}
