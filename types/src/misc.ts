import z from 'zod';
import { ResolutionSchema } from './schemas/miscSchemas.js';
import {
  ExternalIdSchema,
  GlobalExternalIdSchema,
  MultiExternalIdSchema,
} from './schemas/utilSchemas.js';

export type Resolution = z.infer<typeof ResolutionSchema>;

export type ExternalId = z.infer<typeof ExternalIdSchema>;

export type GlobalExternalId = z.infer<typeof GlobalExternalIdSchema>;

export type MultiExternalId = z.infer<typeof MultiExternalIdSchema>;
