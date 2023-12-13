import {
  Collection,
  Entity,
  Enum,
  ManyToMany,
  Property,
  Unique,
} from '@mikro-orm/core';
import type { Duration } from 'dayjs/plugin/duration.js';
import { DurationType } from '../custom_types/DurationType.js';
import { BaseEntity } from './BaseEntity.js';
import { Channel } from './Channel.js';
import { CustomShow } from './CustomShow.js';
import { FillerShow } from './FillerShow.js';
import { Program as ProgramDTO } from 'dizquetv-types';

@Entity()
@Unique({ properties: ['sourceType', 'externalSourceId', 'externalKey'] })
export class Program extends BaseEntity {
  @Enum(() => ProgramSourceType)
  sourceType!: ProgramSourceType;

  @Property({ nullable: true })
  originalAirDate?: string;

  @Property({ type: DurationType })
  durationMs!: Duration;

  @Property({ nullable: true })
  episode?: number;

  @Property({ nullable: true })
  episodeIcon?: string;

  @Property({ nullable: true })
  filePath?: string;

  @Property({ nullable: true })
  icon?: string;

  @Property()
  externalSourceId!: string; // e.g., Plex server name

  @Property()
  externalKey!: string;

  // We'll see if we still need this
  @Property({ nullable: true })
  plexRatingKey?: string;

  @Property({ nullable: true })
  rating?: string;

  @Property({ nullable: true })
  season?: number;

  @Property({ nullable: true })
  seasonIcon?: string;

  @Property({ nullable: true })
  showIcon?: string;

  @Property({ nullable: true })
  showTitle?: string;

  @Property({ nullable: true })
  summary?: string;

  @Property()
  title!: string;

  @Property()
  type!: ProgramType;

  @Property({ nullable: true })
  year?: number;

  @Property({ nullable: true })
  customOrder?: number;

  @ManyToMany(() => Channel, (channel) => channel.programs, { eager: false })
  channels = new Collection<Channel>(this);

  @ManyToMany(() => Channel, (channel) => channel.fallback, { eager: false })
  channelFallbacks = new Collection<Channel>(this);

  @ManyToMany(() => CustomShow, (customShow) => customShow.content, {
    eager: false,
  })
  customShows = new Collection<CustomShow>(this);

  @ManyToMany(() => FillerShow, (fillerShow) => fillerShow.content, {
    eager: false,
  })
  fillerShows = new Collection<FillerShow>(this);

  get contentKey() {
    return `${this.sourceType}|${this.externalSourceId}|${this.externalKey}`;
  }

  toDTO(): ProgramDTO {
    return {
      date: this.originalAirDate,
      duration: this.durationMs.asMilliseconds(),
      episode: this.episode,
      episodeIcon: this.episodeIcon,
      file: this.filePath,
      id: this.uuid,
      icon: this.icon,
      isOffline: false,
      key: this.externalKey,
      rating: this.rating,
      ratingKey: this.plexRatingKey,
      season: this.season,
      seasonIcon: this.seasonIcon,
      serverKey: this.externalSourceId,
      showIcon: this.showIcon,
      showTitle: this.showTitle,
      summary: this.summary,
      title: this.title,
      type: this.type,
      year: this.year,
    };
  }
}

export enum ProgramSourceType {
  PLEX = 'plex',
}

export enum ProgramType {
  Movie = 'movie',
  Episode = 'episode',
  Track = 'track',
}

function enumKeys<O extends object, K extends keyof O = keyof O>(obj: O): K[] {
  return Object.keys(obj).filter((k) => !Number.isNaN(k)) as K[];
}

export function programTypeFromString(str: string): ProgramType | undefined {
  for (const key of enumKeys(ProgramType)) {
    const value = ProgramType[key];
    if (key.toLowerCase() === str) {
      return value;
    }
  }
  return;
}
