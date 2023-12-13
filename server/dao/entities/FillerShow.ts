import { Collection, Entity, ManyToMany, Property } from '@mikro-orm/core';
import { BaseEntity } from './BaseEntity.js';
import { Channel } from './Channel.js';
import { Program } from './Program.js';

@Entity()
export class FillerShow extends BaseEntity {
  @Property()
  name!: string;

  @ManyToMany(() => Program, 'fillerShows', { owner: true })
  content = new Collection<Program>(this);

  @ManyToMany({ entity: () => Channel, mappedBy: (channel) => channel.fillers })
  channels = new Collection<Channel>(this);
}
