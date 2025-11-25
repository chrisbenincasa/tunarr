import type { TupleToUnion } from '@tunarr/types';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { Artwork } from './Artwork.ts';
import { Program } from './Program.ts';
import { ProgramGrouping } from './ProgramGrouping.ts';

export const CreditTypes = ['cast', 'director', 'writer', 'producer'] as const;

export type CreditType = TupleToUnion<typeof CreditTypes>;

export const Credit = sqliteTable(
  'credit',
  {
    uuid: text().primaryKey(),
    type: text({ enum: CreditTypes }).notNull(),
    name: text().notNull(),
    role: text(),
    index: integer(),
    createdAt: integer({ mode: 'timestamp_ms' }),
    updatedAt: integer({ mode: 'timestamp_ms' }),
    programId: text().references(() => Program.uuid, { onDelete: 'cascade' }),
    groupingId: text().references(() => ProgramGrouping.uuid, {
      onDelete: 'cascade',
    }),
  },
  (table) => [
    index('credit_program_id_idx').on(table.programId),
    index('credit_grouping_id_idx').on(table.groupingId),
  ],
);

export const CreditRelations = relations(Credit, ({ many, one }) => ({
  artwork: many(Artwork),
  program: one(Program, {
    fields: [Credit.programId],
    references: [Program.uuid],
  }),
  grouping: one(ProgramGrouping, {
    fields: [Credit.groupingId],
    references: [ProgramGrouping.uuid],
  }),
}));

export type Credit = InferSelectModel<typeof Credit>;
export type NewCredit = InferInsertModel<typeof Credit>;
