import { Entity, Property, Unique } from '@mikro-orm/core';
import { PlexServerSettings as PlexServerSettingsDTO } from '@tunarr/types';
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

  // Nullable for now!
  @Property({ nullable: true })
  clientIdentifier?: string;

  toDTO(): PlexServerSettingsDTO {
    return {
      id: this.uuid,
      name: this.name,
      uri: this.uri,
      accessToken: this.accessToken,
      sendChannelUpdates: this.sendChannelUpdates,
      sendGuideUpdates: this.sendGuideUpdates,
      index: this.index,
      clientIdentifier: this.clientIdentifier,
    };
  }
}
