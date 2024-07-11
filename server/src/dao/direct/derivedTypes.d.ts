import { DeepNullable, MarkRequired } from 'ts-essentials';
import * as RawType from './types.gen';
import { Selectable } from 'kysely';
import { ChannelIcon, ChannelOfflineSettings } from '../entities/Channel.js';
import { MarkNonNullable } from '../../types/util';

export type ProgramType = 'movie' | 'episode' | 'track';

export type Program = Selectable<RawType.Program> & {
  // TODO: Encode this in the DB so the generated types are correct
  // type: 'movie' | 'episode' | 'track';
  tvShow?: DeepNullable<Partial<Selectable<RawType.ProgramGrouping>>> | null;
  tvSeason?: DeepNullable<Partial<Selectable<RawType.ProgramGrouping>>> | null;
  trackArtist?: DeepNullable<
    Partial<Selectable<RawType.ProgramGrouping>>
  > | null;
  trackAlbum?: DeepNullable<
    Partial<Selectable<RawType.ProgramGrouping>>
  > | null;
  externalIds?: Selectable<RawType.ProgramExternalId>[] | null; // Always require that we select the full external ID details
};

export type Channel = Selectable<
  Omit<RawType.Channel, 'icon' | 'offline'> & {
    icon?: ChannelIcon;
    offline?: ChannelOfflineSettings;
  }
> & {
  programs?: Program[];
};

export type ChannelFillerShow = Selectable<RawType.ChannelFillerShow> & {
  fillerShow: MarkNonNullable<
    DeepNullable<Selectable<RawType.FillerShow>>,
    'uuid'
  >;
  fillerContent?: Program[];
};

export type ChannelWithPrograms = MarkRequired<Channel, 'programs'>;

export type DB = Omit<RawType.DB, 'channel'> & {
  channel: Channel;
};
