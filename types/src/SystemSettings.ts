import { z } from 'zod/v4';
import { BackupSettingsSchema } from './schemas/settingsSchemas.js';
import { RecurrenceScheduleSchema } from './schemas/utilSchemas.js';
import { type TupleToUnion } from './util.js';

export const LogCategories = ['scheduling', 'streaming'] as const;

export const LogCategoriesSchema = z.enum([...LogCategories]);

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

export const LogLevelsSchema = z.enum([...LogLevels]);

export type LogLevel = TupleToUnion<typeof LogLevels>;

export const LogRollConfigSchema = z.object({
  enabled: z.boolean().default(false),
  maxFileSizeBytes: z.number().positive().optional(),
  rolledFileLimit: z.number().positive(),
  schedule: RecurrenceScheduleSchema.optional(),
});

export const LoggingSettingsSchema = z.object({
  logLevel: LogLevelsSchema,
  categoryLogLevel: z
    .partialRecord(LogCategoriesSchema, LogLevelsSchema.optional())
    .optional(),
  logsDirectory: z.string(),
  useEnvVarLevel: z.boolean().default(true),
  logRollConfig: LogRollConfigSchema.optional().default({
    enabled: false,
    maxFileSizeBytes: Math.pow(2, 20), // 1MB => 1,048,576 bytes
    rolledFileLimit: 3,
  }),
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
