import { Entity, Property, Unique } from '@mikro-orm/core';
import { BaseEntity } from './BaseEntity.js';
import { PlexServerSettings as PlexServerSettingsDTO } from '@tunarr/types';

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

  toDTO(): PlexServerSettingsDTO {
    return {
      id: this.uuid,
      name: this.name,
      uri: this.uri,
      accessToken: this.accessToken,
      sendChannelUpdates: this.sendChannelUpdates,
      sendGuideUpdates: this.sendGuideUpdates,
      index: this.index,
    };
  }
}
