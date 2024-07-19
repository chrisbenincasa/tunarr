import z from 'zod';
import {
  JellyfinServerSettingsSchema,
  MediaSourceSettingsSchema,
  PlexServerSettingsSchema,
  PlexStreamSettingsSchema,
} from './schemas/settingsSchemas.js';

export type PlexServerSettings = z.infer<typeof PlexServerSettingsSchema>;

export type JellyfinServerSettings = z.infer<
  typeof JellyfinServerSettingsSchema
>;

export type MediaSourceSettings = z.infer<typeof MediaSourceSettingsSchema>;

export type PlexStreamSettings = z.infer<typeof PlexStreamSettingsSchema>;

export const defaultPlexStreamSettings = PlexStreamSettingsSchema.parse({});
