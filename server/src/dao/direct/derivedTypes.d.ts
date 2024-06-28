import { DeepNullable, MarkRequired } from 'ts-essentials';
import * as RawType from './types.gen';
import { Selectable } from 'kysely';
import { ChannelIcon, ChannelOfflineSettings } from '../entities/Channel.js';

export type Program = Selectable<RawType.Program> & {
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

export type ChannelWithPrograms = MarkRequired<Channel, 'programs'>;

export type DB = Omit<RawType.DB, 'channel'> & {
  channel: Channel;
};
