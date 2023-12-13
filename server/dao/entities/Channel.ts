import {
  Collection,
  Entity,
  ManyToMany,
  Property,
  Unique,
} from '@mikro-orm/core';
import { Resolution } from 'dizquetv-types';
import { BaseEntity } from './BaseEntity.js';
import { FillerShow } from './FillerShow.js';
import { Program } from './Program.js';
import { CustomShow } from './CustomShow.js';
import { ChannelFillerShow } from './ChannelFillerShow.js';
import { Channel as ChannelDTO } from 'dizquetv-types';

type ChannelIcon = {
  path: string;
  width: number;
  duration: number;
  position: string;
};

type ChannelTranscodingSettings = {
  targetResolution: Resolution;
  videoBitrate?: number;
  videoBufferSize?: number;
};

type ChannelWatermark = {
  url?: string;
  enabled: boolean;
  position: string;
  width: number;
  verticalMargin: number;
  horizontalMargin: number;
  duration: number;
  fixedSize: boolean;
  animated: boolean;
};

type ChannelOfflineSettings = {
  picture?: string;
  soundtrack?: string;
  mode: string;
};

@Entity()
@Unique({ properties: ['number'] })
export class Channel extends BaseEntity {
  static fromDTO(channel: ChannelDTO): Channel {
    const entity = new Channel();
    entity.number = channel.number;
    entity.icon = channel.icon;
    entity.guideMinimumDurationSeconds = channel.guideMinimumDurationSeconds;
    entity.name = channel.name;
    entity.duration = channel.duration;
    entity.stealth = channel.stealth;
    entity.groupTitle = channel.groupTitle;
    entity.startTime = channel.startTimeEpoch;
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

  @Property({ type: 'json', nullable: true })
  icon?: ChannelIcon;

  @ManyToMany(() => Program, 'channels', { owner: true })
  programs = new Collection<Program>(this);

  @Property()
  guideMinimumDurationSeconds!: number;

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

  @Property({ type: 'json' })
  offline!: ChannelOfflineSettings;

  // Filler collections
  @ManyToMany({
    entity: () => FillerShow,
    pivotEntity: () => ChannelFillerShow,
  })
  fillers = new Collection<FillerShow>(this);

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
      number: this.number,
      watermark: this.watermark,
      // filler
      // programs
      // fallback
      icon: this.icon ?? {
        path: '',
        duration: 0,
        position: '',
        width: 0,
      },
      guideMinimumDurationSeconds: this.guideMinimumDurationSeconds,
      groupTitle: this.groupTitle || '',
      disableFillerOverlay: this.disableFillerOverlay,
      startTimeEpoch: this.startTime,
      offline: this.offline,
      name: this.name,
      transcoding: this.transcoding,
      duration: this.duration,
      stealth: this.stealth,
      programs: [],
    };
  }
}
