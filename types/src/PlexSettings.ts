import z from 'zod';
import {
  PlexServerSettingsInsert,
  PlexServerSettingsRemove,
  PlexServerSettingsSchema,
  PlexStreamSettingsSchema,
} from './schemas/settingsSchemas.js';

export type PlexServerSettings = z.infer<typeof PlexServerSettingsSchema>;

export type PlexServerInsert = z.infer<typeof PlexServerSettingsInsert>;

export type PlexServerRemove = z.infer<typeof PlexServerSettingsRemove>;

export type PlexStreamSettings = z.infer<typeof PlexStreamSettingsSchema>;

export const defaultPlexStreamSettings = PlexStreamSettingsSchema.parse({});
