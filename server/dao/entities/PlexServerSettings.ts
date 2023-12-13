import { Entity, Property, Unique } from '@mikro-orm/core';
import { BaseEntity } from './BaseEntity.js';

@Entity()
@Unique({ properties: ['name', 'uri'] })
export class PlexServerSettings extends BaseEntity {
  @Property()
  name!: string;

  @Property()
  uri!: string;

  @Property()
  accessToken!: string;

  @Property({ default: true })
  sendGuideUpdates!: boolean;

  @Property({ default: true })
  sendChannelUpdates!: boolean;

  @Property()
  index: number;
}
