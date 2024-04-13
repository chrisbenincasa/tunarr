import type { Rel } from '@mikro-orm/core';
import { Entity, ManyToOne, Property } from '@mikro-orm/core';
import { Channel } from './Channel.js';
import { FillerShow } from './FillerShow.js';

@Entity()
export class ChannelFillerShow {
  @ManyToOne({ primary: true, entity: () => FillerShow })
  fillerShow!: Rel<FillerShow>;

  @ManyToOne({ primary: true, entity: () => Channel })
  channel!: Rel<Channel>;

  @Property()
  weight!: number;

  @Property()
  cooldown!: number; // Seconds
}
