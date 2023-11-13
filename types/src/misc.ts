import { ResolutionSchema } from './schemas/miscSchemas.js';
import z from 'zod';

export type Resolution = z.infer<typeof ResolutionSchema>;
