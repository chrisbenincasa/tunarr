import type {
  CreateFillerListRequest,
  UpdateFillerListRequest,
} from '@tunarr/types/api';
import type {
  FillerShowWithContent,
  IFillerListDB,
} from '../../db/interfaces/IFillerListDB.ts';
import type { ChannelFillerShowWithContent } from '../../db/schema/derivedTypes.js';
import type { ProgramDao } from '../../db/schema/Program.ts';
import type { Maybe, Nilable } from '../../types/util.ts';

export class FakeFillerDB implements IFillerListDB {
  getFiller(id: string): Promise<Maybe<FillerShowWithContent>> {
    throw new Error('Method not implemented.');
  }
  saveFiller(
    id: string,
    updateRequest: UpdateFillerListRequest,
  ): Promise<Nilable<FillerShowWithContent>> {
    throw new Error('Method not implemented.');
  }
  createFiller(createRequest: CreateFillerListRequest): Promise<string> {
    throw new Error('Method not implemented.');
  }
  getFillerChannels(
    id: string,
  ): Promise<Array<{ number: number; name: string }>> {
    throw new Error('Method not implemented.');
  }
  deleteFiller(id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  getAllFillerIds(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
  getFillerPrograms(id: string): Promise<ProgramDao[]> {
    throw new Error('Method not implemented.');
  }
  getFillersFromChannel(
    channelId: string,
  ): Promise<ChannelFillerShowWithContent[]> {
    throw new Error('Method not implemented.');
  }
}
