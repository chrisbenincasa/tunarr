import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const SmartCollection = sqliteTable('smart_collection', {
  uuid: text().primaryKey(),
  name: text().notNull(),
  query: text().notNull(),
});

export type SmartCollection = InferSelectModel<typeof SmartCollection>;
export type NewSmartCollection = InferInsertModel<typeof SmartCollection>;
