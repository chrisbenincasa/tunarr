import type { Ref } from '@mikro-orm/core';
import { Entity, ManyToOne, Property } from '@mikro-orm/core';
import { Channel } from './Channel.js';
import { FillerShow } from './FillerShow.js';

@Entity()
export class ChannelFillerShow {
  @ManyToOne({ primary: true, entity: () => FillerShow })
  fillerShow!: Ref<FillerShow>;

  @ManyToOne({ primary: true, entity: () => Channel })
  channel!: Ref<Channel>;

  @Property()
  weight!: number;

  @Property()
  cooldown!: number; // Seconds
}
