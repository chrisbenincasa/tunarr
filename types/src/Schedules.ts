import type { z } from 'zod';
import type {
  ScheduleSchema,
  ScheduleSlotTypes,
  SlotAnchorModes,
  SlotFillModes,
  SlotIterationDirections,
  SlotIterationOrders,
} from './schemas/scheduleSchemas.js';
import type { TupleToUnion } from './util.js';

export type ScheduleSlotType = TupleToUnion<typeof ScheduleSlotTypes>;
export type SlotAnchorMode = TupleToUnion<typeof SlotAnchorModes>;
export type SlotIterationOrder = TupleToUnion<typeof SlotIterationOrders>;
export type SlotIterationDirection = TupleToUnion<
  typeof SlotIterationDirections
>;
export type SlotFillMode = TupleToUnion<typeof SlotFillModes>;

export type Schedule = z.infer<typeof ScheduleSchema>;
