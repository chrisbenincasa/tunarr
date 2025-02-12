import type z from 'zod/v4';
import type { MediaSourceLibrarySchema } from './schemas/settingsSchemas.js';
import {
  type EmbyServerSettingsSchema,
  GlobalMediaSourceSettingsSchema,
  type JellyfinServerSettingsSchema,
  type MediaSourceSettingsSchema,
  type PlexServerSettingsSchema,
  PlexStreamSettingsSchema,
} from './schemas/settingsSchemas.js';
import type { Prettify } from './util.js';

export type PlexServerSettings = z.infer<typeof PlexServerSettingsSchema>;

export type JellyfinServerSettings = z.infer<
  typeof JellyfinServerSettingsSchema
>;

export type EmbyServerSettings = z.infer<typeof EmbyServerSettingsSchema>;

export type MediaSourceSettings = Prettify<
  z.infer<typeof MediaSourceSettingsSchema>
>;

export type MediaSourceLibrary = z.infer<typeof MediaSourceLibrarySchema>;

export type MediaSourceType = MediaSourceSettings['type'];

export type PlexStreamSettings = z.infer<typeof PlexStreamSettingsSchema>;

export const defaultPlexStreamSettings = PlexStreamSettingsSchema.parse({});

export const defaultGlobalMediaSourceSettings =
  GlobalMediaSourceSettingsSchema.parse({});
