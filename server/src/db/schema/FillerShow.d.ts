import { Insertable, Selectable } from 'kysely';
import { WithCreatedAt, WithUpdatedAt, WithUuid } from './base.ts';

export interface FillerShowTable
  extends WithUuid,
    WithCreatedAt,
    WithUpdatedAt {
  name: string;
}

export type FillerShow = Selectable<FillerShowTable>;
export type NewFillerShow = Insertable<FillerShowTable>;
export interface FillerShowContentTable {
  fillerShowUuid: string;
  index: number;
  programUuid: string;
}

export type FillerShowContent = Selectable<FillerShowContentTable>;
export type NewFillerShowContent = Insertable<FillerShowContentTable>;
