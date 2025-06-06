import type z from 'zod/v4';
import type { ExternalId } from './Program.js';
import type {
  HealthCheckSchema,
  ResolutionSchema,
} from './schemas/miscSchemas.js';
import type {
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

export type HealthCheck = z.infer<typeof HealthCheckSchema>;
