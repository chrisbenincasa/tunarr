import { Collection, Entity, ManyToMany, Property } from '@mikro-orm/core';
import { TaggedIdBaseEntity } from './BaseEntity2.js';
import { Channel } from './Channel.js';
import { FillerListContent } from './FillerListContent.js';
import { Program } from './Program.js';
import type { Tag } from '@tunarr/types';

const FillerShowIdTag = 'FillerShowId';

export type FillerShowId = Tag<string, typeof FillerShowIdTag>;

@Entity()
export class FillerShow extends TaggedIdBaseEntity<typeof FillerShowIdTag> {
  @Property()
  name!: string;

  @ManyToMany({ entity: () => Program, pivotEntity: () => FillerListContent })
  content = new Collection<Program>(this);

  @ManyToMany({ entity: () => Channel, mappedBy: (channel) => channel.fillers })
  channels = new Collection<Channel>(this);
}
