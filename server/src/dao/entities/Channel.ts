import {
  Collection,
  Entity,
  IType,
  ManyToMany,
  Property,
  Unique,
} from '@mikro-orm/core';
import { Channel as ChannelDTO, Resolution } from '@tunarr/types';
import { type Tag } from '@tunarr/types';
import { nilToUndefined } from '../../util/index.js';
import { BaseEntity } from './BaseEntity.js';
import { ChannelFillerShow } from './ChannelFillerShow.js';
import { CustomShow } from './CustomShow.js';
import { FillerShow } from './FillerShow.js';
import { Program } from './Program.js';
import { z } from 'zod';
import { SchemaBackedDbType } from '../custom_types/SchemaBackedDbType.js';

const ChannelIconSchema = z
  .object({
    path: z.string().catch(''),
    width: z.number().nonnegative().catch(0),
    duration: z.number().catch(0),
    position: z
      .union([
        z.literal('top-left'),
        z.literal('top-right'),
        z.literal('bottom-left'),
        z.literal('bottom-right'),
      ])
      .catch('bottom-right'),
  })
  .catch({
    path: '',
    width: 0,
    duration: 0,
    position: 'bottom-right',
  });

const DefaultChannelIcon = ChannelIconSchema.parse({});

type ChannelIcon = z.infer<typeof ChannelIconSchema>;

class ChannelIconType extends SchemaBackedDbType<typeof ChannelIconSchema> {
  constructor() {
    super(ChannelIconSchema);
  }
}

export type ChannelTranscodingSettings = {
  targetResolution?: Resolution;
  videoBitrate?: number;
  videoBufferSize?: number;
};

type ChannelWatermark = {
  url?: string;
  enabled: boolean;
  position: 'bottom-left' | 'bottom-right' | 'top-right' | 'top-left';
  width: number;
  verticalMargin: number;
  horizontalMargin: number;
  duration: number;
  fixedSize?: boolean;
  animated?: boolean;
};

type ChannelOfflineSettings = {
  picture?: string;
  soundtrack?: string;
  mode: 'pic' | 'clip';
};

const ChannelIdTag = 'ChannelId';

export type ChannelId = Tag<string, typeof ChannelIdTag>;

@Entity()
@Unique({ properties: ['number'] })
export class Channel extends BaseEntity {
  static fromDTO(channel: ChannelDTO): Channel {
    const entity = new Channel();
    entity.number = channel.number;
    entity.icon = channel.icon;
    entity.guideMinimumDuration = channel.guideMinimumDuration;
    entity.name = channel.name;
    entity.duration = channel.duration;
    entity.stealth = channel.stealth;
    entity.groupTitle = channel.groupTitle;
    entity.startTime = channel.startTime;
    entity.offline = channel.offline;
    entity.watermark = channel.watermark;
    entity.transcoding = channel.transcoding;
    return entity;
  }

  static fromPartialDTO(channel: Partial<ChannelDTO>): Partial<Channel> {
    return {
      ...channel,
    } as Partial<Channel>;
  }

  @Property()
  number!: number;

  @Property({ type: ChannelIconType, columnType: 'json', nullable: true })
  icon?: IType<ChannelIcon, string>;

  @ManyToMany(() => Program, 'channels', { owner: true })
  programs = new Collection<Program>(this);

  // Stored in millis
  @Property({ type: 'int', name: 'guide_minimum_duration' })
  guideMinimumDuration: number;

  @Property({ default: false })
  disableFillerOverlay: boolean = false;

  @Property()
  name!: string;

  @Property()
  duration!: number;

  @Property({ default: false })
  stealth!: boolean;

  @Property()
  groupTitle?: string;

  @Property()
  startTime!: number;

  // The title of 'flex' when shown in the guide.
  // If null, it will show the channel's name.
  @Property()
  guideFlexTitle?: string;

  @Property({
    type: 'json',
    nullable: true,
    default: JSON.stringify({ mode: 'clip' } as ChannelOfflineSettings),
  })
  offline!: ChannelOfflineSettings;

  // Filler collections
  @ManyToMany({
    entity: () => FillerShow,
    pivotEntity: () => ChannelFillerShow,
  })
  fillers = new Collection<FillerShow>(this);

  @Property({ nullable: true })
  fillerRepeatCooldown?: number; // Seconds

  @ManyToMany(() => CustomShow)
  customShows = new Collection<CustomShow>(this);

  // Watermark
  @Property({ type: 'json', nullable: true })
  watermark?: ChannelWatermark;

  // Transcoding
  @Property({ type: 'json', nullable: true })
  transcoding?: ChannelTranscodingSettings;

  @ManyToMany(() => Program)
  fallback = new Collection<Program>(this);

  toDTO(): ChannelDTO {
    return {
      id: this.uuid,
      number: this.number,
      watermark: nilToUndefined(this.watermark),
      // filler
      // programs
      // fallback
      icon: this.icon ?? DefaultChannelIcon,
      guideMinimumDuration: this.guideMinimumDuration,
      groupTitle: this.groupTitle || '',
      disableFillerOverlay: this.disableFillerOverlay,
      startTime: this.startTime,
      offline: this.offline,
      name: this.name,
      transcoding: nilToUndefined(this.transcoding),
      duration: this.duration,
      stealth: this.stealth,
    };
  }
}
