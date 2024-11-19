import { Lineup } from '@/db/derived_types/Lineup.ts';
import { ChannelWithRelations } from '@/db/schema/derivedTypes.js';

export type ChannelAndLineup = {
  channel: ChannelWithRelations;
  lineup: Lineup;
};
