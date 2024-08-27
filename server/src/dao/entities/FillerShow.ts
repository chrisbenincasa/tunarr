import { Collection, Entity, ManyToMany, Property } from '@mikro-orm/core';
import type { Tag } from '@tunarr/types';
import { TaggedIdBaseEntity } from './BaseEntity2.js';
import { Channel } from './Channel.js';
import { ChannelFillerShow } from './ChannelFillerShow.js';
import { FillerListContent } from './FillerListContent.js';
import { Program } from './Program.js';

const FillerShowIdTag = 'FillerShowId';

export type FillerShowId = Tag<string, typeof FillerShowIdTag>;

@Entity()
export class FillerShow extends TaggedIdBaseEntity<typeof FillerShowIdTag> {
  @Property()
  name!: string;

  @ManyToMany({ entity: () => Program, pivotEntity: () => FillerListContent })
  content = new Collection<Program>(this);

  @ManyToMany({
    entity: () => Channel,
    pivotEntity: () => ChannelFillerShow,
    owner: true,
  })
  channels = new Collection<Channel>(this);
}
