import type { ChannelOrm } from '../../db/schema/Channel.ts';
import type {
  ChannelFillerShowWithContent,
  ProgramWithRelations,
} from '../../db/schema/derivedTypes.js';
import type { Nullable } from '../../types/util.ts';

export type FillerPickResult = {
  fillerListId: Nullable<string>;
  filler: Nullable<ProgramWithRelations>;
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
  ): Promise<FillerPickResult>;
}
export const DefaultFillerCooldownMillis = 30 * 60 * 1000;
