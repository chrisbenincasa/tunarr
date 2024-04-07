import {
  Cascade,
  Collection,
  Entity,
  EntityDTO,
  Enum,
  Index,
  ManyToMany,
  ManyToOne,
  OptionalProps,
  Property,
  Unique,
  serialize,
  type Rel,
} from '@mikro-orm/core';
import { Program as ProgramDTO } from '@tunarr/types';
import type { Duration } from 'dayjs/plugin/duration.js';
import { enumKeys } from '../../util/enumUtil.js';
import { ProgramSourceType } from '../custom_types/ProgramSourceType.js';
import { BaseEntity } from './BaseEntity.js';
import { Channel } from './Channel.js';
import { CustomShow } from './CustomShow.js';
import { FillerShow } from './FillerShow.js';
import { ProgramGrouping } from './ProgramGrouping.js';

/**
 * Program represents a 'playable' entity. A movie, episode, or music track
 * can be a Program, but a show, season, music album or artist, cannot.
 */
@Entity()
@Unique({ properties: ['sourceType', 'externalSourceId', 'externalKey'] })
@Index({ properties: ['sourceType', 'externalSourceId', 'plexRatingKey'] })
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

  // For TV Shows, this is the season key
  @Property({ nullable: true })
  parentExternalKey?: string;

  // For TV shows, this is the show key
  @Property({ nullable: true })
  grandparentExternalKey?: string;

  // G, PG, etc
  @Property({ nullable: true })
  rating?: string;

  @Property({ nullable: true, name: 'season' })
  seasonNumber?: number;

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

  @Enum()
  type!: ProgramType;

  @Property({ nullable: true })
  year?: number;

  @Property({ nullable: true })
  artistName?: string;

  @Property({ nullable: true })
  albumName?: string;

  @ManyToMany(() => Channel, (channel) => channel.programs, { eager: false })
  channels = new Collection<Channel>(this);

  @ManyToMany(() => Channel, (channel) => channel.fallback, { eager: false })
  channelFallbacks = new Collection<Channel>(this);

  @ManyToMany({
    entity: () => CustomShow,
    eager: false,
    mappedBy: (e) => e.content,
  })
  customShows = new Collection<CustomShow>(this);

  @ManyToMany({
    entity: () => FillerShow,
    eager: false,
    mappedBy: (e) => e.content,
  })
  fillerShows = new Collection<FillerShow>(this);

  @ManyToOne(() => ProgramGrouping, { nullable: true })
  season?: Rel<ProgramGrouping>;

  @ManyToOne(() => ProgramGrouping, {
    nullable: true,
    cascade: [Cascade.PERSIST],
  })
  tvShow?: Rel<ProgramGrouping>;

  @ManyToOne(() => ProgramGrouping, { nullable: true })
  album?: Rel<ProgramGrouping>;

  @ManyToOne(() => ProgramGrouping, { nullable: true })
  artist?: Rel<ProgramGrouping>;

  get contentKey() {
    return `${this.sourceType}|${this.externalSourceId}|${this.externalKey}`;
  }

  toDTO(): ProgramDTO {
    return programDaoToDto(serialize(this as Program, { skipNull: true }));
  }

  uniqueId(): string {
    return `${this.sourceType}|${this.externalSourceId}|${this.externalKey}`;
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
    key: program.externalKey,
    rating: program.rating,
    ratingKey: program.plexRatingKey,
    season: program.seasonNumber,
    seasonIcon: program.seasonIcon,
    serverKey: program.externalSourceId,
    showIcon: program.showIcon,
    showTitle: program.showTitle,
    sourceType: 'plex',
    summary: program.summary,
    title: program.title,
    type: program.type,
    year: program.year,
  };
}

export enum ProgramType {
  Movie = 'movie',
  Episode = 'episode',
  Track = 'track',
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
