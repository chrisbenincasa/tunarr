import { Loaded } from '@mikro-orm/core';
import { Channel } from '../dao/entities/Channel.js';
import { Lineup } from '../dao/derived_types/Lineup.js';

export type ChannelAndLineup = {
  channel: Loaded<Channel>;
  lineup: Lineup;
};
