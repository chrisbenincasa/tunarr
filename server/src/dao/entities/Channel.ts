import {
  Cascade,
  Collection,
  Entity,
  IType,
  ManyToMany,
  OneToMany,
  Property,
  Unique,
} from '@mikro-orm/core';
import { Channel as ChannelDTO, type Tag } from '@tunarr/types';
import {
  ContentProgramTypeSchema,
  ResolutionSchema,
} from '@tunarr/types/schemas';
import { z } from 'zod';
import { SchemaBackedDbType } from '../custom_types/SchemaBackedDbType.js';
import { BaseEntity } from './BaseEntity.js';
import { ChannelFillerShow } from './ChannelFillerShow.js';
import { CustomShow } from './CustomShow.js';
import { FillerShow } from './FillerShow.js';
import { Program } from './Program.js';

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

export const DefaultChannelIcon = ChannelIconSchema.parse({});

export type ChannelIcon = z.infer<typeof ChannelIconSchema>;

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
  opacity: z.number().min(0).max(100).int().optional().catch(100).default(100),
  fadeConfig: z
    .array(
      z.object({
        programType: ContentProgramTypeSchema.optional().catch(undefined),
        // Encodes on/off period of displaying the watermark in mins.
        // e.g. a 5m period fades in the watermark every 5th min and displays it
        // for 5 mins.
        periodMins: z.number().positive().min(1),
        leadingEdge: z.boolean().optional().catch(true),
      }),
    )
    .optional(),
});

export type ChannelWatermark = z.infer<typeof ChannelWatermarkSchema>;

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

export type ChannelOfflineSettings = z.infer<
  typeof ChannelOfflineSettingsSchema
>;

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

  // Fillers
  @ManyToMany({
    entity: () => FillerShow,
    pivotEntity: () => ChannelFillerShow,
    mappedBy: (filler) => filler.channels,
    cascade: [Cascade.PERSIST, Cascade.REMOVE],
  })
  fillers = new Collection<FillerShow>(this);

  @OneToMany({
    entity: () => ChannelFillerShow,
    mappedBy: 'channel',
  })
  channelFillers = new Collection<ChannelFillerShow>(this);

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
}
