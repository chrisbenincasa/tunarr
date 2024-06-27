import { DeepNullable } from 'ts-essentials';
import * as RawType from './types.gen';

export type Program = RawType.Program & {
  tv_show: DeepNullable<Partial<RawType.ProgramGrouping>> | null;
  tv_season: DeepNullable<Partial<RawType.ProgramGrouping>> | null;
  track_artist: DeepNullable<Partial<RawType.ProgramGrouping>> | null;
  track_album: DeepNullable<Partial<RawType.ProgramGrouping>> | null;
};
