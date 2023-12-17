import z from 'zod';
import {
  PlexServerSettingsInsert,
  PlexServerSettingsSchema,
  PlexStreamSettingsSchema,
} from './schemas/settingsSchemas.js';

export type PlexServerSettings = z.infer<typeof PlexServerSettingsSchema>;

export type PlexServerInsert = z.infer<typeof PlexServerSettingsInsert>;

export type PlexStreamSettings = z.infer<typeof PlexStreamSettingsSchema>;

export const defaultPlexStreamSettings = PlexStreamSettingsSchema.parse({});
