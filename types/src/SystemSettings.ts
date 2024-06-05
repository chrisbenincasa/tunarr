import { z } from 'zod';
import { TupleToUnion } from './util.js';
import { BackupSettingsSchema } from './schemas/settingsSchemas.js';

export const LogLevelsSchema = z.union([
  z.literal('silent'),
  z.literal('fatal'),
  z.literal('error'),
  z.literal('warn'),
  z.literal('info'),
  z.literal('http'),
  z.literal('debug'),
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
  'trace',
] as const;

export type LogLevel = TupleToUnion<typeof LogLevels>;

export const LoggingSettingsSchema = z.object({
  logLevel: LogLevelsSchema,
  logsDirectory: z.string(),
  useEnvVarLevel: z.boolean().default(true),
});

export type LoggingSettings = z.infer<typeof LoggingSettingsSchema>;

export const SystemSettingsSchema = z.object({
  backup: BackupSettingsSchema,
  logging: LoggingSettingsSchema,
});

export type SystemSettings = z.infer<typeof SystemSettingsSchema>;
