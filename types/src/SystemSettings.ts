import { z } from 'zod/v4';
import { BackupSettingsSchema } from './schemas/settingsSchemas.js';
import { type TupleToUnion } from './util.js';

export const LogLevelsSchema = z.union([
  z.literal('silent'),
  z.literal('fatal'),
  z.literal('error'),
  z.literal('warn'),
  z.literal('info'),
  z.literal('http'),
  z.literal('debug'),
  z.literal('http_out'),
  z.literal('trace'),
]);

export const LogLevels = [
  'silent',
  'fatal',
  'error',
  'warn',
  'info',
  'http',
  'debug',
  'http_out',
  'trace',
] as const;

export type LogLevel = TupleToUnion<typeof LogLevels>;

export const LoggingSettingsSchema = z.object({
  logLevel: LogLevelsSchema,
  logsDirectory: z.string(),
  useEnvVarLevel: z.boolean().default(true),
});

export type LoggingSettings = z.infer<typeof LoggingSettingsSchema>;

export const CacheSettingsSchema = z.object({
  // Preserve previous behavior
  enablePlexRequestCache: z.boolean().optional().default(false).catch(false),
});

export type CacheSettings = z.infer<typeof CacheSettingsSchema>;

export const SearchServerSettingsSchema = z.object({
  maxIndexingMemory: z.number().optional(),
  snapshotIntervalHours: z.number().default(4),
});

export const ServerSettingsSchema = z.object({
  port: z.number().min(1).max(65535).optional().default(8000),
  searchSettings: SearchServerSettingsSchema,
});

export type ServerSettings = z.infer<typeof ServerSettingsSchema>;

export const DefaultServerSettings = {
  port: 8000,
  searchSettings: {
    snapshotIntervalHours: 4,
  },
} satisfies ServerSettings;

export const SystemSettingsSchema = z.object({
  backup: BackupSettingsSchema,
  logging: LoggingSettingsSchema,
  cache: CacheSettingsSchema.optional(),
  server: ServerSettingsSchema.default(DefaultServerSettings),
});

export type SystemSettings = z.infer<typeof SystemSettingsSchema>;
