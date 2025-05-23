import { type z } from 'zod/v4';
import {
  type CustomShowProgrammingSchema,
  type CustomShowSchema,
} from './schemas/customShowsSchema.js';

type Alias<T> = T & { _?: never };

export type CustomShow = Alias<z.infer<typeof CustomShowSchema>>;

export type CustomShowProgramming = Alias<
  z.infer<typeof CustomShowProgrammingSchema>
>;
