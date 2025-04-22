import type { z } from 'zod';
import type {
  SubtitleFilterSchema,
  SubtitlePreference,
} from './schemas/subtitleSchema.js';

export type SubtitlePreference = z.infer<typeof SubtitlePreference>;

export type SubtitleFilter = z.infer<typeof SubtitleFilterSchema>;
