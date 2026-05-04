import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { StreamSelectionRule } from '@tunarr/types/schemas';

export const StreamSelectionProfile = sqliteTable('stream_selection_profiles', {
  uuid: text().primaryKey(),
  name: text().notNull(),
  rules: text({ mode: 'json' }).$type<StreamSelectionRule[]>().notNull(),
  createdAt: integer({ mode: 'timestamp_ms' }),
  updatedAt: integer({ mode: 'timestamp_ms' }),
});
