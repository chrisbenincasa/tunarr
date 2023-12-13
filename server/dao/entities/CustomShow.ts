import { Collection, Entity, ManyToMany, Property } from '@mikro-orm/core';
import { BaseEntity } from './BaseEntity.js';
import { Program } from './Program.js';
import { Channel } from './Channel.js';

@Entity()
export class CustomShow extends BaseEntity {
  @Property()
  name!: string;

  @ManyToMany(() => Program, 'customShows', { owner: true })
  content = new Collection<Program>(this);

  @ManyToMany(() => Channel, (channel) => channel.customShows)
  channels = new Collection<Channel>(this);
}
