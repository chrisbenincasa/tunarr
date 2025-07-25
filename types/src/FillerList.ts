import type { z } from 'zod/v4';
import type {
  FillerListProgrammingSchema,
  FillerListSchema,
} from './schemas/fillerSchema.js';

type Alias<T> = T & { _?: never };

export type FillerList = Alias<z.infer<typeof FillerListSchema>>;

export type FillerListProgramming = Alias<
  z.infer<typeof FillerListProgrammingSchema>
>;
