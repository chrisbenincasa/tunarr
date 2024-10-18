import { Lineup } from '../dao/derived_types/Lineup.js';
import { ChannelWithRelations } from '../dao/direct/derivedTypes.js';

export type ChannelAndLineup = {
  channel: ChannelWithRelations;
  lineup: Lineup;
};
