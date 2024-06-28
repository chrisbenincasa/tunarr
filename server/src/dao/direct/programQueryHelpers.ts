import { ExpressionBuilder } from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/sqlite';
import { ProgramType } from '../entities/Program';
import { DB } from './types.gen';

export function withTvShow(eb: ExpressionBuilder<DB, 'program'>) {
  return jsonObjectFrom(
    eb
      .selectFrom('programGrouping as pg')
      .select(['pg.uuid', 'pg.title', 'pg.year'])
      .whereRef('pg.uuid', '=', 'program.tvShowUuid')
      .where('program.type', '=', ProgramType.Episode)
      .orderBy('uuid'),
  ).as('tvShow');
}

export function withTvSeason(eb: ExpressionBuilder<DB, 'program'>) {
  return jsonObjectFrom(
    eb
      .selectFrom('programGrouping as pg')
      .select(['pg.uuid', 'pg.title', 'pg.year'])
      .whereRef('pg.uuid', '=', 'program.seasonUuid')
      .where('program.type', '=', ProgramType.Episode)
      .orderBy('uuid'),
  ).as('tvSeason');
}

export function withTrackArtist(eb: ExpressionBuilder<DB, 'program'>) {
  return jsonObjectFrom(
    eb
      .selectFrom('programGrouping as pg')
      .select(['pg.uuid', 'pg.title', 'pg.year'])
      .whereRef('pg.uuid', '=', 'program.artistUuid')
      .where('program.type', '=', ProgramType.Track)
      .orderBy('uuid'),
  ).as('trackArtist');
}

export function withTrackAlbum(eb: ExpressionBuilder<DB, 'program'>) {
  return jsonObjectFrom(
    eb
      .selectFrom('programGrouping as pg')
      .select(['pg.uuid', 'pg.title', 'pg.year'])
      .whereRef('pg.uuid', '=', 'program.albumUuid')
      .where('program.type', '=', ProgramType.Track)
      .orderBy('uuid'),
  ).as('trackAlbum');
}

export function withProgramExternalIds(eb: ExpressionBuilder<DB, 'program'>) {
  return jsonArrayFrom(
    eb
      .selectFrom('programExternalId as eid')
      .select(['eid.sourceType', 'eid.externalSourceId', 'eid.externalKey'])
      .whereRef('eid.programUuid', '=', 'program.uuid'),
  ).as('externalIds');
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
  eb: ExpressionBuilder<DB, 'channelPrograms'>,
  programJoins: ProgramJoins = defaultProgramJoins,
) {
  return jsonArrayFrom(
    eb
      .selectFrom('program')
      .select([
        'program.albumName',
        'program.albumUuid',
        'program.artistName',
        'program.artistUuid',
        'program.createdAt',
        'program.duration',
        'program.episode',
        'program.episodeIcon',
        'program.externalKey',
        'program.externalSourceId',
        'program.filePath',
        'program.grandparentExternalKey',
        'program.icon',
        'program.originalAirDate',
        'program.parentExternalKey',
        'program.plexFilePath',
        'program.plexRatingKey',
        'program.rating',
        'program.seasonIcon',
        'program.seasonNumber',
        'program.seasonUuid',
        'program.showIcon',
        'program.showTitle',
        'program.sourceType',
        'program.summary',
        'program.title',
        'program.tvShowUuid',
        'program.type',
        'program.updatedAt',
        'program.uuid',
        'program.year',
      ])
      .$if(programJoins.trackAlbum, (qb) => qb.select(withTrackAlbum))
      .$if(programJoins.trackArtist, (qb) => qb.select(withTrackArtist))
      .$if(programJoins.tvSeason, (qb) => qb.select(withTvSeason))
      .$if(programJoins.tvSeason, (qb) => qb.select(withTvShow))
      .whereRef('program.uuid', '=', 'channelPrograms.programUuid'),
  ).as('programs');
}
