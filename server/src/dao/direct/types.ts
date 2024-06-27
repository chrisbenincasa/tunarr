import { Nullable } from '../../types/util';
import { ProgramSourceType } from '../custom_types/ProgramSourceType';
import { Selectable } from 'kysely';

export interface Database {
  program: DirectProgramDAO;
}

export interface DirectProgramDAO {
  uuid: string;

  sourceType: ProgramSourceType;

  duration: number;

  episode: Nullable<number>;

  year: Nullable<number>;
}

export type ProgramDAO = Selectable<DirectProgramDAO>;
