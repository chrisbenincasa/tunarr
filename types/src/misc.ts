import z from 'zod';
import { ResolutionSchema } from './schemas/miscSchemas.js';
import {
  ExternalIdSchema,
  MultiExternalIdSchema,
  SingleExternalIdSchema,
} from './schemas/utilSchemas.js';

export type Resolution = z.infer<typeof ResolutionSchema>;

export type ExternalId = z.infer<typeof ExternalIdSchema>;

export type SingleExternalId = z.infer<typeof SingleExternalIdSchema>;

export type MultiExternalId = z.infer<typeof MultiExternalIdSchema>;
