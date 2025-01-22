import type { Insertable, Selectable } from 'kysely';
import type { WithCreatedAt, WithUpdatedAt, WithUuid } from './base.ts';

export interface CustomShowTable
  extends WithUuid,
    WithCreatedAt,
    WithUpdatedAt {
  name: string;
}

export type CustomShow = Selectable<CustomShowTable>;
export type NewCustomShow = Insertable<CustomShowTable>;

export interface CustomShowContentTable {
  contentUuid: string;
  customShowUuid: string;
  index: number;
}

export type CustomShowContent = Selectable<CustomShowContentTable>;
export type NewCustomShowContent = Insertable<CustomShowContentTable>;
