import type { Lineup } from '@/db/derived_types/Lineup.js';
import type { ChannelWithRelations } from '@/db/schema/derivedTypes.js';

export type ChannelAndLineup = {
  channel: ChannelWithRelations;
  lineup: Lineup;
};

export type PlexT = 'plex';
export type JellyfinT = 'jellyfin';
export type EmbyT = 'emby';
