import type z from 'zod/v4';
import type {
  LocalMediaSourceSchema,
  MediaSourceContentType,
  MediaSourceLibrarySchema,
  MediaSourcePathReplacement,
} from './schemas/settingsSchemas.js';
import {
  type EmbyServerSettingsSchema,
  GlobalMediaSourceSettingsSchema,
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

export type LocalMediaSource = z.infer<typeof LocalMediaSourceSchema>;

export type MediaSourceSettings = z.infer<typeof MediaSourceSettingsSchema>;

export type RemoteMediaSourceSettings = Exclude<
  MediaSourceSettings,
  { type: 'local' }
>;

export type MediaSourceLibrary = z.infer<typeof MediaSourceLibrarySchema>;

export type MediaSourceType = MediaSourceSettings['type'];
export type MediaSourceContentType = z.infer<typeof MediaSourceContentType>;

export type PlexStreamSettings = z.infer<typeof PlexStreamSettingsSchema>;

export const defaultPlexStreamSettings = PlexStreamSettingsSchema.parse({});

export const defaultGlobalMediaSourceSettings =
  GlobalMediaSourceSettingsSchema.parse({});

export type MediaSourcePathReplacement = z.infer<
  typeof MediaSourcePathReplacement
>;
