import {
  Collection,
  Entity,
  IType,
  ManyToMany,
  Property,
  Unique,
} from '@mikro-orm/core';
import { Channel as ChannelDTO } from '@tunarr/types';
import { type Tag } from '@tunarr/types';
import { nilToUndefined } from '../../util/index.js';
import { BaseEntity } from './BaseEntity.js';
import { ChannelFillerShow } from './ChannelFillerShow.js';
import { CustomShow } from './CustomShow.js';
import { FillerShow } from './FillerShow.js';
import { Program } from './Program.js';
import { z } from 'zod';
import { SchemaBackedDbType } from '../custom_types/SchemaBackedDbType.js';
import { ResolutionSchema } from '@tunarr/types/schemas';

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

const ChannelTranscodingSettingsSchema = z.object({
  targetResolution: ResolutionSchema.optional().catch(undefined),
  videoBitrate: z.number().nonnegative().optional().catch(undefined),
  videoBufferSize: z.number().nonnegative().optional().catch(undefined),
});

export type ChannelTranscodingSettings = z.infer<
  typeof ChannelTranscodingSettingsSchema
>;

class ChannelTranscodingSettingsType extends SchemaBackedDbType<
  typeof ChannelTranscodingSettingsSchema
> {
  constructor() {
    super(ChannelTranscodingSettingsSchema);
  }
}

const ChannelWatermarkSchema = z.object({
  url: z.string().optional().catch(undefined),
  enabled: z.boolean().catch(false),
  position: z
    .union([
      z.literal('bottom-left'),
      z.literal('bottom-right'),
      z.literal('top-right'),
      z.literal('top-left'),
    ])
    .catch('bottom-right'),
  width: z.number().nonnegative().catch(2), // percentage
  verticalMargin: z.number().nonnegative().catch(0),
  horizontalMargin: z.number().nonnegative().catch(0),
  duration: z.number().nonnegative().catch(0),
  fixedSize: z.boolean().optional().catch(undefined),
  animated: z.boolean().optional().catch(undefined),
});

type ChannelWatermark = z.infer<typeof ChannelWatermarkSchema>;

class ChannelWatermarkType extends SchemaBackedDbType<
  typeof ChannelWatermarkSchema
> {
  constructor() {
    super(ChannelWatermarkSchema);
  }
}

const ChannelOfflineSettingsSchema = z.object({
  picture: z.string().optional(),
  soundtrack: z.string().optional(),
  mode: z.union([z.literal('pic'), z.literal('clip')]).catch('clip'),
});

const DefaultChannelOfflineSettingsSchema = ChannelOfflineSettingsSchema.parse(
  {},
);

type ChannelOfflineSettings = z.infer<typeof ChannelOfflineSettingsSchema>;

class ChannelOfflineSettingsType extends SchemaBackedDbType<
  typeof ChannelOfflineSettingsSchema
> {
  constructor() {
    super(ChannelOfflineSettingsSchema);
  }
}

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
    columnType: 'json',
    type: ChannelOfflineSettingsType,
    nullable: true,
    default: JSON.stringify(DefaultChannelOfflineSettingsSchema),
  })
  offline!: IType<ChannelOfflineSettings, string>;

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
  @Property({ type: ChannelWatermarkType, columnType: 'json', nullable: true })
  watermark?: IType<ChannelWatermark, string>;

  // Transcoding
  @Property({
    type: ChannelTranscodingSettingsType,
    columnType: 'json',
    nullable: true,
  })
  transcoding?: IType<ChannelTranscodingSettings, string>;

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
