import { scheduleTimeSlots } from '@tunarr/shared';
import type { ChannelProgram } from '@tunarr/types';
import type { TimeSlotSchedule } from '@tunarr/types/api';
import { parentPort, workerData } from 'node:worker_threads';

const { schedule, programs } = workerData as {
  schedule: TimeSlotSchedule;
  programs: ChannelProgram[];
};

parentPort?.postMessage(await scheduleTimeSlots(schedule, programs));
