import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Insertable, Selectable } from 'kysely';
import { type KyselifyBetter } from './KyselifyBetter.ts';

export const CachedImage = sqliteTable('cached_image', {
  hash: text().notNull().primaryKey(),
  mimeType: text(),
  url: text().notNull(),
});

export type CachedImageTable = KyselifyBetter<typeof CachedImage>;
export type CachedImage = Selectable<CachedImageTable>;
export type NewCachedImage = Insertable<CachedImageTable>;
