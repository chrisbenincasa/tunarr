import type { ChannelOrm } from '../../db/schema/Channel.ts';
import type {
  ChannelFillerShowWithContent,
  ProgramOrmWithExternalIds,
} from '../../db/schema/derivedTypes.js';
import type { Nullable } from '../../types/util.ts';

export type FillerPickOptions = {
  fillerRepeatCooldownOverrideMs?: number;
  fillerListCooldownOverrides?: Record<string, number>;
};

export type FillerPickResult = {
  fillerListId: Nullable<string>;
  filler: Nullable<ProgramOrmWithExternalIds>;
  minimumWait: number;
};

export const EmptyFillerPickResult: FillerPickResult = {
  filler: null,
  fillerListId: null,
  minimumWait: Number.MAX_SAFE_INTEGER,
};

export interface IFillerPicker {
  pickFiller(
    channel: ChannelOrm,
    fillers: ChannelFillerShowWithContent[],
    maxDuration: number,
    now?: number,
    options?: FillerPickOptions,
  ): Promise<FillerPickResult>;
}
export const DefaultFillerCooldownMillis = 30 * 60 * 1000;
