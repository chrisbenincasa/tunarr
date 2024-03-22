import { Channel, CondensedChannelProgram, isFlexProgram } from '@tunarr/types';
import dayjs from 'dayjs';
import { forEach } from 'lodash-es';
import filter from 'lodash-es/filter';
import negate from 'lodash-es/negate';
import {
  setCurrentLineup,
  updateCurrentChannel,
} from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';

export type StartTimePadding = {
  mod: number;
  description: string;
};

const OneMinuteMillis = 1000 * 60;

export const StartTimePaddingOptions: readonly StartTimePadding[] = [
  { mod: -1, description: 'None' },
  { mod: 5, description: ':05, :10, ..., :55' },
  { mod: 10, description: ':10, :20, ..., :50' },
  { mod: 15, description: ':00, :15, :30, :45' },
  { mod: 30, description: ':00, :30' },
  { mod: 60, description: ':00' },
  { mod: 20, description: ':20, :40, :00' },
] as const;

export function usePadStartTimes() {
  const channel = useStore((s) => s.channelEditor.currentEntity);
  const programs = useStore(materializedProgramListSelector);

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
  programs: CondensedChannelProgram[],
  padding: StartTimePadding | null,
) {
  const mod =
    !padding || padding.mod <= 0 ? OneMinuteMillis : padding.mod * 60 * 1000;
  const startTime = dayjs(channel?.startTime).unix() * 1000;
  const newStartTime = startTime - (startTime % mod);
  const filteredPrograms = filter(programs, negate(isFlexProgram));

  let lastStartTime = newStartTime;
  const newProgramList: CondensedChannelProgram[] = [];
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
