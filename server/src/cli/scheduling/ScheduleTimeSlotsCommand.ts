import { scheduleTimeSlots } from '@tunarr/shared';
import { TimeSlotScheduleSchema } from '@tunarr/types/api';
import { performance } from 'node:perf_hooks';
import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import type { CommandModule } from 'yargs';
import { container } from '../../container.ts';
import type { IChannelDB } from '../../db/interfaces/IChannelDB.ts';
import { KEYS } from '../../types/inject.ts';

type ScheduleTimeSlotsCommandArgs = {
  config: unknown;
};

export const ScheduleTimeSlotsCommand: CommandModule<
  ScheduleTimeSlotsCommandArgs,
  ScheduleTimeSlotsCommandArgs
> = {
  command: 'time-slots',
  // describe: 'Update Tunarr settings directly.',
  builder: (yargs) =>
    yargs.usage('$0 schedule time-slots ').option('config', {
      type: 'string',
      coerce(arg: string) {
        return JSON.parse(arg) as unknown;
      },
      requiresArg: false,
    }),
  // .option('pretty', {
  //   type: 'boolean',
  //   default: false,
  //   desc: 'Print settings JSON with spacing',
  // })
  // .option('settings', {
  //   type: 'string',
  // })
  // .example([
  //   [
  //     '$0 settings update --settings.ffmpeg.ffmpegExecutablePath="/usr/bin/ffmpeg"',
  //     'Update FFmpeg executable path',
  //   ],
  // ]),
  handler: async (args) => {
    performance.mark('handler-start');
    console.log(args.config);
    if (!isMainThread) {
      console.log(workerData);
      const schedule = TimeSlotScheduleSchema.parse(workerData);
      const channelDB = container.get<IChannelDB>(KEYS.ChannelDB);
      const channel = await channelDB.getChannel(1);
      if (!channel) {
        throw new Error('');
      }

      const lineup = await channelDB.loadAndMaterializeLineup(channel.uuid);
      const result = await scheduleTimeSlots(schedule, lineup?.programs ?? []);
      console.log(result);
      parentPort?.postMessage(result);
    }
    performance.mark('handler-end');
    const { duration } = performance.measure(
      'handler',
      'handler-start',
      'handler-end',
    );
    console.log(`took ${duration}`);
  },
};
