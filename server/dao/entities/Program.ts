import {
  Collection,
  Entity,
  EntityDTO,
  Enum,
  ManyToMany,
  OptionalProps,
  Property,
  Unique,
  serialize,
} from '@mikro-orm/core';
import type { Duration } from 'dayjs/plugin/duration.js';
import { Program as ProgramDTO } from 'dizquetv-types';
import { BaseEntity } from './BaseEntity.js';
import { Channel } from './Channel.js';
import { CustomShow } from './CustomShow.js';
import { FillerShow } from './FillerShow.js';

@Entity()
@Unique({ properties: ['sourceType', 'externalSourceId', 'externalKey'] })
export class Program extends BaseEntity {
  [OptionalProps] = 'durationMs';

  @Enum(() => ProgramSourceType)
  sourceType!: ProgramSourceType;

  @Property({ nullable: true })
  originalAirDate?: string;

  @Property()
  duration!: number;

  set durationObj(duration: Duration) {
    this.duration = duration.asMilliseconds();
  }

  @Property({ nullable: true })
  episode?: number;

  @Property({ nullable: true })
  episodeIcon?: string;

  /**
   * Previously "file"
   */
  @Property({ nullable: true })
  filePath?: string;

  @Property({ nullable: true })
  icon?: string;

  /**
   * Previously "serverKey"
   */
  @Property()
  externalSourceId!: string; // e.g., Plex server name

  /**
   * Previously "key"
   */
  @Property()
  externalKey!: string;

  /**
   * Previously "ratingKey"
   */
  @Property({ nullable: true })
  plexRatingKey?: string;

  /**
   * Previously "plexFile"
   */
  @Property({ nullable: true })
  plexFilePath?: string;

  // G, PG, etc
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
    return programDaoToDto(serialize(this as Program, { skipNull: true }));
  }

  uniqueId(): string {
    return `${this.sourceType}_${this.externalSourceId}_${this.externalKey}`;
  }
}

export function programDaoToDto(program: EntityDTO<Program>): ProgramDTO {
  return {
    date: program.originalAirDate,
    duration: program.duration,
    episode: program.episode,
    episodeIcon: program.episodeIcon,
    file: program.filePath,
    id: program.uuid,
    icon: program.icon,
    isOffline: false,
    key: program.externalKey,
    rating: program.rating,
    ratingKey: program.plexRatingKey,
    season: program.season,
    seasonIcon: program.seasonIcon,
    serverKey: program.externalSourceId,
    showIcon: program.showIcon,
    showTitle: program.showTitle,
    summary: program.summary,
    title: program.title,
    type: program.type,
    year: program.year,
  };
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

export function programSourceTypeFromString(
  str: string,
): ProgramSourceType | undefined {
  for (const key of enumKeys(ProgramSourceType)) {
    const value = ProgramSourceType[key];
    if (key.toLowerCase() === str) {
      return value;
    }
  }
  return;
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
