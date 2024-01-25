import { z } from 'zod';
import {
  FillerListProgrammingSchema,
  FillerListSchema,
} from './schemas/fillerSchema.js';

type Alias<T> = T & { _?: never };

export type FillerList = Alias<z.infer<typeof FillerListSchema>>;

export type FillerListProgramming = Alias<
  z.infer<typeof FillerListProgrammingSchema>
>;
