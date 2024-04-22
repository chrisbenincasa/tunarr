import { z } from 'zod';

const SchedulingOperationSchema = z.object({});

const AddPaddingSchedulingOperationSchema = z.object({
  mod: z.number(),
  allowedOffsets: z.array(z.number()).optional(),
});
