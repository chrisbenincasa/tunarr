import type { TranscodeConfig } from '@tunarr/types';
import type {
  TranscodeConfigNotFoundError,
  WrappedError,
} from '../types/errors.ts';
import type { Result } from '../types/result.ts';
import type { Maybe } from '../types/util.ts';
import type { TranscodeConfigOrm } from './schema/TranscodeConfig.ts';

export interface ITranscodeConfigDB {
  getAll(): Promise<TranscodeConfigOrm[]>;
  getById(id: string): Promise<Maybe<TranscodeConfigOrm>>;
  getDefaultConfig(): Promise<Maybe<TranscodeConfigOrm>>;
  getChannelConfig(channelId: string): Promise<TranscodeConfigOrm>;
  insertConfig(
    config: Omit<TranscodeConfig, 'id'>,
  ): Promise<TranscodeConfigOrm>;
  duplicateConfig(
    id: string,
  ): Promise<
    Result<TranscodeConfigOrm, TranscodeConfigNotFoundError | WrappedError>
  >;
  updateConfig(id: string, updatedConfig: TranscodeConfig): Promise<void>;
  deleteConfig(id: string): Promise<void>;
}
