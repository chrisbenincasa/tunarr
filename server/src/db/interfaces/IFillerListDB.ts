import type { ContentProgram } from '@tunarr/types';
import type {
  CreateFillerListRequest,
  UpdateFillerListRequest,
} from '@tunarr/types/api';
import type { MarkRequired } from 'ts-essentials';
import type { Maybe, Nilable } from '../../types/util.ts';
import type { FillerShow } from '../schema/FillerShow.ts';
import type { ProgramDao } from '../schema/Program.ts';
import type { ChannelFillerShowWithContent } from '../schema/derivedTypes.js';

export interface IFillerListDB {
  getFiller(id: string): Promise<Maybe<FillerShowWithContent>>;
  getFillerListsByIds(
    ids: string[],
  ): Promise<(FillerShow & { contentCount: number })[]>;
  saveFiller(
    id: string,
    updateRequest: UpdateFillerListRequest,
  ): Promise<Nilable<FillerShowWithContent>>;
  createFiller(createRequest: CreateFillerListRequest): Promise<string>;
  getFillerChannels(
    id: string,
  ): Promise<Array<{ number: number; name: string }>>;
  deleteFiller(id: string): Promise<void>;
  getAllFillerIds(): Promise<string[]>;
  getFillerPrograms(id: string): Promise<MarkRequired<ContentProgram, 'id'>[]>;
  getFillersFromChannel(
    channelId: string,
  ): Promise<ChannelFillerShowWithContent[]>;
}

export type FillerShowWithContent = FillerShow & {
  fillerContent: Array<
    ProgramDao & {
      index: number;
    }
  >;
};
