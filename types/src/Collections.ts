import type z from 'zod';
import type { SmartCollection } from './schemas/collectionsSchema.js';

export type SmartCollection = z.infer<typeof SmartCollection>;
