import {
  Collection,
  Entity,
  EntityDTO,
  Enum,
  Index,
  ManyToMany,
  ManyToOne,
  OneToMany,
  Property,
  Ref,
  Unique,
  serialize,
} from '@mikro-orm/core';
import { createExternalId } from '@tunarr/shared';
import { Program as ProgramDTO } from '@tunarr/types';
import { enumKeys } from '../../util/enumUtil.js';
import { ProgramSourceType } from '../custom_types/ProgramSourceType.js';
import { BaseEntity } from './BaseEntity.js';
import { Channel } from './Channel.js';
import { CustomShow } from './CustomShow.js';
import { FillerShow } from './FillerShow.js';
import { ProgramExternalId } from './ProgramExternalId.js';
import { ProgramGrouping } from './ProgramGrouping.js';

/**
 * Program represents a 'playable' entity. A movie, episode, or music track
 * can be a Program, but a show, season, music album or artist, cannot.
 */
@Entity()
@Unique({ properties: ['sourceType', 'externalSourceId', 'externalKey'] })
@Index({ properties: ['sourceType', 'externalSourceId', 'plexRatingKey'] })
export class Program extends BaseEntity {
  /**
   * @deprecated Programs will soon be able to have multiple sources
   */
  @Enum(() => ProgramSourceType)
  sourceType!: ProgramSourceType;

  @Property({ nullable: true })
  originalAirDate?: string;

  /**
   * Program duration in milliseconds.
   */
  @Property()
  duration!: number;

  @Property({ nullable: true })
  episode?: number;

  // TODO: This should probably be factored into the source-specific table
  @Property({ nullable: true })
  episodeIcon?: string;

  /**
   * Previously "file"
   * @deprecated Do not read from this field. Use the program_external_id table instead
   */
  @Property({ nullable: true })
  filePath?: string;

  @Property({ nullable: true })
  icon?: string;

  /**
   * Previously "serverKey"
   * @deprecated Do not read from this field. Use the apporpriate entry from the `program_external_id` table instead
   */
  @Property()
  externalSourceId!: string; // e.g., Plex server name

  /**
   * Previously "key"
   * @deprecated Use the external key selected from the external IDs relation
   */
  @Property()
  externalKey!: string;

  /**
   * Previously "ratingKey"
   * @deprecated
   */
  @Property({ nullable: true })
  plexRatingKey?: string;

  /**
   * Previously "plexFile"
   * @deprecated Use the file path on the associated external ID
   */
  @Property({ nullable: true })
  plexFilePath?: string;

  /**
   * For TV Shows, this is the season key
   * @deprecated Prefer joining on the relevant `program_grouping` + `program_grouping_external_id` entries
   */
  @Property({ nullable: true })
  parentExternalKey?: string;

  /**
   * For TV shows, this is the show key
   * @deprecated Prefer joining on the relevant `program_grouping` + `program_grouping_external_id` entries
   */
  @Property({ nullable: true })
  grandparentExternalKey?: string;

  // G, PG, etc
  @Property({ nullable: true })
  rating?: string;

  @Property({ nullable: true, name: 'season_number' })
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

  @ManyToOne(() => ProgramGrouping, {
    nullable: true,
    ref: true, // Disable cascade persist because of the unique partial indexes here
    lazy: true,
    // We have to manage this manually.
    cascade: [],
  })
  season?: Ref<ProgramGrouping>;

  @ManyToOne(() => ProgramGrouping, {
    nullable: true,
    ref: true,
    lazy: true,
    // Disable cascade persist because of the unique partial indexes here
    // We have to manage this manually.
    cascade: [],
  })
  tvShow?: Ref<ProgramGrouping>;

  @ManyToOne(() => ProgramGrouping, {
    nullable: true,
    ref: true,
    lazy: true,
    // Disable cascade persist because of the unique partial indexes here
    // We have to manage this manually.
    cascade: [],
  })
  album?: Ref<ProgramGrouping>;

  @ManyToOne(() => ProgramGrouping, {
    nullable: true,
    ref: true,
    lazy: true,
    // Disable cascade persist because of the unique partial indexes here
    // We have to manage this manually.
    cascade: [],
  })
  artist?: Ref<ProgramGrouping>;

  @OneToMany(() => ProgramExternalId, (eid) => eid.program, {
    eager: true,
    // Disable cascade persist because of the unique partial indexes here
    // We have to manage this manually.
    cascade: [],
  })
  externalIds = new Collection<ProgramExternalId>(this);

  toDTO(): ProgramDTO {
    return programDaoToDto(serialize(this as Program, { skipNull: true }));
  }

  uniqueId(): string {
    return createExternalId(
      this.sourceType,
      this.externalSourceId,
      this.externalKey,
    );
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
    externalKey: program.externalKey,
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
