import { Entity, ManyToOne, Property, Rel } from '@mikro-orm/core';
import { Duration } from 'dayjs/plugin/duration.js';
import { DurationType } from '../custom_types/DurationType.js';
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

  @Property({ type: DurationType })
  cooldown!: Duration;
}
