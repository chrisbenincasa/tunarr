import type z from 'zod/v4';
import {
  type EmbyServerSettingsSchema,
  type JellyfinServerSettingsSchema,
  type MediaSourceSettingsSchema,
  type PlexServerSettingsSchema,
  PlexStreamSettingsSchema,
} from './schemas/settingsSchemas.js';

export type PlexServerSettings = z.infer<typeof PlexServerSettingsSchema>;

export type JellyfinServerSettings = z.infer<
  typeof JellyfinServerSettingsSchema
>;

export type EmbyServerSettings = z.infer<typeof EmbyServerSettingsSchema>;

export type MediaSourceSettings = z.infer<typeof MediaSourceSettingsSchema>;

export type MediaSourceType = MediaSourceSettings['type'];

export type PlexStreamSettings = z.infer<typeof PlexStreamSettingsSchema>;

export const defaultPlexStreamSettings = PlexStreamSettingsSchema.parse({});
