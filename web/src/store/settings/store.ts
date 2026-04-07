import type { TupleToUnion } from '@tunarr/types';
import type { DeepPartial } from 'ts-essentials';
import { z } from 'zod';
import type { StateCreator } from 'zustand';

// Only these 2 are supported currently
export const SupportedLocales = ['en', 'en-gb'] as const;
export type SupportedLocales = TupleToUnion<typeof SupportedLocales>;

const CurrentSettingsSchemaVersion = 1;

const PaginationStateSchema = z.object({
  pageIndex: z.int(),
  pageSize: z.int(),
});

const TableSettingsSchema = z.object({
  pagination: PaginationStateSchema.optional(),
  columnModel: z.record(z.string(), z.boolean()).optional(),
  sortState: z
    .array(
      z.object({
        desc: z.boolean(),
        id: z.string(),
      }),
    )
    .optional(),
});

export const SettingsStateInternalSchema = z.object({
  version: z.int().optional().default(CurrentSettingsSchemaVersion),
  backendUri: z.string(),
  ui: z.object({
    channelTablePagination: PaginationStateSchema,
    channelTableColumnModel: z.record(z.string(), z.boolean()),
    i18n: z.object({
      locale: z.enum(SupportedLocales),
    }),
    tableSettings: z.record(z.string(), TableSettingsSchema),
    showAdvancedSettings: z.boolean(),
  }),
});

export type SettingsStateInternal = z.infer<typeof SettingsStateInternalSchema>;

export const SettingsStateSchema = z.object({
  settings: SettingsStateInternalSchema,
});

export type SettingsState = z.infer<typeof SettingsStateSchema>;

export type PersistedSettingsState = DeepPartial<SettingsState>;

// By default, the dev environment runs its web server on port
// 5173. In 'prod' we assume that by default the user wants
// their web UI to hit their self-hosted instance of Tunarr,
// which will be on the same host/port.
export const DefaultBackendUri = import.meta.env.DEV
  ? 'http://localhost:8000'
  : '';

export const createSettingsSlice: StateCreator<SettingsState> = () => ({
  settings: {
    version: CurrentSettingsSchemaVersion,
    backendUri: DefaultBackendUri,
    ui: {
      channelTablePagination: {
        pageIndex: 0,
        pageSize: 10,
      },
      channelTableColumnModel: {
        onDemand: false,
      },
      i18n: {
        locale: 'en',
      },
      tableSettings: {},
      showAdvancedSettings: false,
    },
  },
});
