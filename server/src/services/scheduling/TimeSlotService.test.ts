import bugReproJson from '@/resources/test/lineup/time-slot-bug-repro1.json';
import { UpdateChannelProgrammingRequestSchema } from '@tunarr/types/api';
import { scheduleTimeSlots } from './TimeSlotService.ts';

describe('TimeSlotService', () => {
  test('bug repro 1', async () => {
    const parsed = UpdateChannelProgrammingRequestSchema.parse(bugReproJson);
    assert(parsed.type === 'time');
    const x = await scheduleTimeSlots(parsed.schedule, parsed.programs);
    console.log(x);
  });
});
