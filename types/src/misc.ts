import z from 'zod';
import { ExternalId } from './Program.js';
import { ResolutionSchema } from './schemas/miscSchemas.js';
import {
  MultiExternalIdSchema,
  SingleExternalIdSchema,
} from './schemas/utilSchemas.js';

export type Resolution = z.infer<typeof ResolutionSchema>;

export function externalIdEquals(a: ExternalId, b: ExternalId): boolean {
  if (a.type !== b.type) {
    return false;
  }

  if (a.type === 'multi') {
    return a.id === b.id && a.source === b.source && a.sourceId === b.sourceId;
  }

  return a.id === b.id && a.source === b.source;
}

export type SingleExternalId = z.infer<typeof SingleExternalIdSchema>;

export type MultiExternalId = z.infer<typeof MultiExternalIdSchema>;
