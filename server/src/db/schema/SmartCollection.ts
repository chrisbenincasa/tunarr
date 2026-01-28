import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const SmartCollection = sqliteTable('smart_collection', {
  uuid: text().primaryKey(),
  name: text().notNull(),
  filter: text('query'),
  keywords: text(),
});

export type SmartCollection = InferSelectModel<typeof SmartCollection>;
export type NewSmartCollection = InferInsertModel<typeof SmartCollection>;
