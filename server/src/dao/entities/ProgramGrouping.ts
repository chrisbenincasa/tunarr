import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  Property,
} from '@mikro-orm/core';
import { BaseEntity } from './BaseEntity.js';
import { Program } from './Program.js';
import { ProgramGroupingExternalId } from './ProgramGroupingExternalId.js';
import { Maybe } from '../../types/util.js';
import { find } from 'lodash-es';
import { enumKeys } from '../../util/enumUtil.js';
import { JellyfinItemKind } from '@tunarr/types/jellyfin';

/**
 * A ProgramGrouping represents some logical collection of Programs.
 * For instance, a TV show, TV show season, Music album, or music artist
 * are all groupings.
 */
@Entity()
export class ProgramGrouping extends BaseEntity {
  @Property()
  type!: ProgramGroupingType;

  @Property()
  title!: string;

  @Property({ nullable: true })
  summary?: string;

  @Property({ nullable: true })
  icon?: string;

  @Property({ nullable: true })
  year?: number;

  @Property({ nullable: true })
  index?: number; // For seasons, this is the season number

  // Self-references - these are gropuings that
  // are neither the root nor the leaf (Program)
  // of a hierarchy, e.g. a season or album
  @ManyToOne()
  show?: ProgramGrouping;

  @OneToMany(() => ProgramGrouping, (group) => group.show)
  seasons = new Collection<ProgramGrouping>(this);

  @ManyToOne()
  artist?: ProgramGrouping;

  @OneToMany(() => ProgramGrouping, (group) => group.artist)
  albums = new Collection<ProgramGrouping>(this);

  // Program references
  @OneToMany(() => Program, (p) => p.season)
  seasonEpisodes = new Collection<Program>(this);

  @OneToMany(() => Program, (p) => p.tvShow)
  showEpisodes = new Collection<Program>(this);

  @OneToMany(() => Program, (p) => p.album)
  albumTracks = new Collection<Program>(this);

  @OneToMany(() => Program, (p) => p.artist)
  artistTracks = new Collection<Program>(this);

  // External references
  @OneToMany(() => ProgramGroupingExternalId, (p) => p.group)
  externalRefs = new Collection<ProgramGroupingExternalId>(this);
}

export enum ProgramGroupingType {
  TvShow = 'show',
  TvShowSeason = 'season',
  MusicArtist = 'artist',
  MusicAlbum = 'album',
}

export function programGroupingTypeForString(
  s: string,
): Maybe<ProgramGroupingType> {
  const key = find(
    enumKeys(ProgramGroupingType),
    (key) => ProgramGroupingType[key].toString() === s,
  );
  if (key) {
    return ProgramGroupingType[key];
  }
  return;
}

export function programGroupingTypeForJellyfinType(
  t: JellyfinItemKind,
): Maybe<ProgramGroupingType> {
  switch (t) {
    case 'Season':
      return ProgramGroupingType.TvShowSeason;
    case 'Series':
      return ProgramGroupingType.TvShow;
    case 'MusicArtist':
      return ProgramGroupingType.MusicArtist;
    case 'MusicAlbum':
      return ProgramGroupingType.MusicAlbum;
    default:
      return;
  }
}
