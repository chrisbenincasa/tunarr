import { DeepNullable } from 'ts-essentials';
import * as RawType from './types.gen';
import { Selectable } from 'kysely';
import { ChannelIcon } from '../entities/Channel.js';

export type Program = Selectable<RawType.Program> & {
  tvShow?: DeepNullable<Partial<Selectable<RawType.ProgramGrouping>>> | null;
  tvSeason?: DeepNullable<Partial<Selectable<RawType.ProgramGrouping>>> | null;
  trackArtist?: DeepNullable<
    Partial<Selectable<RawType.ProgramGrouping>>
  > | null;
  trackAlbum?: DeepNullable<
    Partial<Selectable<RawType.ProgramGrouping>>
  > | null;
};

export type Channel = Selectable<RawType.Channel> & {
  icon?: ChannelIcon;
  programs: Program[];
};

export type DB = RawType.DB & {
  channel: Channel;
};
