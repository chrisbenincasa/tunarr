import { ExpressionBuilder } from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/sqlite';
import { ProgramType } from '../entities/Program';
import { DB } from './types.gen';

export function withTvShow(eb: ExpressionBuilder<DB, 'program'>) {
  return jsonObjectFrom(
    eb
      .selectFrom('program_grouping as pg')
      .select(['pg.uuid', 'pg.title', 'pg.year'])
      .whereRef('pg.uuid', '=', 'program.tv_show_uuid')
      .where('program.type', '=', ProgramType.Episode)
      .orderBy('uuid'),
  ).as('tv_show');
}

export function withTvSeason(eb: ExpressionBuilder<DB, 'program'>) {
  return jsonObjectFrom(
    eb
      .selectFrom('program_grouping as pg')
      .select(['pg.uuid', 'pg.title', 'pg.year'])
      .whereRef('pg.uuid', '=', 'program.season_uuid')
      .where('program.type', '=', ProgramType.Episode)
      .orderBy('uuid'),
  ).as('tv_season');
}

export function withTrackArtist(eb: ExpressionBuilder<DB, 'program'>) {
  return jsonObjectFrom(
    eb
      .selectFrom('program_grouping as pg')
      .select(['pg.uuid', 'pg.title', 'pg.year'])
      .whereRef('pg.uuid', '=', 'program.artist_uuid')
      .where('program.type', '=', ProgramType.Track)
      .orderBy('uuid'),
  ).as('track_artist');
}

export function withTrackAlbum(eb: ExpressionBuilder<DB, 'program'>) {
  return jsonObjectFrom(
    eb
      .selectFrom('program_grouping as pg')
      .select(['pg.uuid', 'pg.title', 'pg.year'])
      .whereRef('pg.uuid', '=', 'program.album_uuid')
      .where('program.type', '=', ProgramType.Track)
      .orderBy('uuid'),
  ).as('track_album');
}

export function withProgramExternalIds(eb: ExpressionBuilder<DB, 'program'>) {
  return jsonArrayFrom(
    eb
      .selectFrom('program_external_id as eid')
      .select(['eid.source_type', 'eid.external_source_id', 'eid.external_key'])
      .whereRef('eid.program_uuid', '=', 'program.uuid'),
  ).as('external_ids');
}

type ProgramJoins = {
  trackAlbum: boolean;
  trackArtist: boolean;
  tvShow: boolean;
  tvSeason: boolean;
};

const defaultProgramJoins: ProgramJoins = {
  trackAlbum: false,
  trackArtist: false,
  tvShow: false,
  tvSeason: false,
};

export function withPrograms(
  eb: ExpressionBuilder<DB, 'channel_programs'>,
  programJoins: ProgramJoins = defaultProgramJoins,
) {
  return jsonArrayFrom(
    eb
      .selectFrom('program')
      .select([
        'program.album_name',
        'program.album_uuid',
        'program.artist_name',
        'program.artist_uuid',
        'program.created_at',
        'program.duration',
        'program.episode',
        'program.episode_icon',
        'program.external_key',
        'program.external_source_id',
        'program.file_path',
        'program.grandparent_external_key',
        'program.icon',
        'program.original_air_date',
        'program.parent_external_key',
        'program.plex_file_path',
        'program.plex_rating_key',
        'program.rating',
        'program.season_icon',
        'program.season_number',
        'program.season_uuid',
        'program.show_icon',
        'program.show_title',
        'program.source_type',
        'program.summary',
        'program.title',
        'program.tv_show_uuid',
        'program.type',
        'program.updated_at',
        'program.uuid',
        'program.year',
      ])
      .$if(programJoins.trackAlbum, (qb) => qb.select(withTrackAlbum))
      .$if(programJoins.trackArtist, (qb) => qb.select(withTrackArtist))
      .$if(programJoins.tvSeason, (qb) => qb.select(withTvSeason))
      .$if(programJoins.tvSeason, (qb) => qb.select(withTvShow))
      .whereRef('program.uuid', '=', 'channel_programs.program_uuid'),
  ).as('programs');
}
