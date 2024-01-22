import { z } from 'zod';
import { CustomShowSchema } from './schemas/customShowsSchema.js';

type Alias<T> = T & { _?: never };

export type CustomShow = Alias<z.infer<typeof CustomShowSchema>>;
