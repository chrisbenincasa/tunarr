import { Selectable } from 'kysely';
import { WithCreatedAt, WithUpdatedAt, WithUuid } from './base';

export interface FillerShowTable
  extends WithUuid,
    WithCreatedAt,
    WithUpdatedAt {
  name: string;
}

export type FillerShow = Selectable<FillerShowTable>;
export interface FillerShowContentTable
  extends WithUuid,
    WithCreatedAt,
    WithUpdatedAt {
  fillerShowUuid: string;
  index: number;
  programUuid: string;
}

export type FillerShowContent = Selectable<FillerShowContentTable>;
