import {
  Cascade,
  Collection,
  Entity,
  ManyToMany,
  Property,
} from '@mikro-orm/core';
import { BaseEntity } from './BaseEntity.js';
import { Channel } from './Channel.js';
import { CustomShowContent } from './CustomShowContent.js';
import { Program } from './Program.js';

@Entity()
export class CustomShow extends BaseEntity {
  @Property()
  name!: string;

  @ManyToMany({
    entity: () => Program,
    pivotEntity: () => CustomShowContent,
    cascade: [Cascade.PERSIST, Cascade.REMOVE],
  })
  content = new Collection<Program>(this);

  @ManyToMany(() => Channel, (channel) => channel.customShows)
  channels = new Collection<Channel>(this);
}
