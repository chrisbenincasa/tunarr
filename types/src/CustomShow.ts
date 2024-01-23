import { z } from 'zod';
import {
  CustomShowProgrammingSchema,
  CustomShowSchema,
} from './schemas/customShowsSchema.js';

type Alias<T> = T & { _?: never };

export type CustomShow = Alias<z.infer<typeof CustomShowSchema>>;

export type CustomShowProgramming = Alias<
  z.infer<typeof CustomShowProgrammingSchema>
>;
