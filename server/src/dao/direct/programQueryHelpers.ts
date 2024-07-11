import { ExpressionBuilder } from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/sqlite';
import { ProgramType } from '../entities/Program';
import {
  Program as RawProgram,
  ProgramGrouping as RawProgramGrouping,
  FillerShow as RawFillerShow,
  DB,
} from './types.gen';
import { isBoolean, merge } from 'lodash-es';
import { DeepRequired } from 'ts-essentials';

type ProgramGroupingFields =
  readonly `programGrouping.${keyof RawProgramGrouping}`[];

export const AllProgramGroupingFields: ProgramGroupingFields = [
  'programGrouping.artistUuid',
  'programGrouping.createdAt',
  'programGrouping.icon',
  'programGrouping.index',
  'programGrouping.showUuid',
  'programGrouping.summary',
  'programGrouping.title',
  'programGrouping.type',
  'programGrouping.updatedAt',
  'programGrouping.uuid',
  'programGrouping.year',
];

export const MinimalProgramGroupingFields: ProgramGroupingFields = [
  'programGrouping.uuid',
  'programGrouping.title',
  'programGrouping.year',
];

type FillerShowFields = readonly `fillerShow.${keyof RawFillerShow}`[];

export const AllFillerShowFields: FillerShowFields = [
  'fillerShow.createdAt',
  'fillerShow.name',
  'fillerShow.updatedAt',
  'fillerShow.uuid',
];

export function withTvShow(
  eb: ExpressionBuilder<DB, 'program'>,
  fields: ProgramGroupingFields = AllProgramGroupingFields,
) {
  return jsonObjectFrom(
    eb
      .selectFrom('programGrouping')
      .select(fields)
      .whereRef('programGrouping.uuid', '=', 'program.tvShowUuid')
      .where('program.type', '=', ProgramType.Episode)
      .orderBy('uuid'),
  ).as('tvShow');
}

export function withTvSeason(
  eb: ExpressionBuilder<DB, 'program'>,
  fields: ProgramGroupingFields = AllProgramGroupingFields,
) {
  return jsonObjectFrom(
    eb
      .selectFrom('programGrouping')
      .select(fields)
      .whereRef('programGrouping.uuid', '=', 'program.seasonUuid')
      .where('program.type', '=', ProgramType.Episode)
      .orderBy('uuid'),
  ).as('tvSeason');
}

export function withTrackArtist(
  eb: ExpressionBuilder<DB, 'program'>,
  fields: ProgramGroupingFields = AllProgramGroupingFields,
) {
  return jsonObjectFrom(
    eb
      .selectFrom('programGrouping')
      .select(fields)
      .whereRef('programGrouping.uuid', '=', 'program.artistUuid')
      .where('program.type', '=', ProgramType.Track)
      .orderBy('uuid'),
  ).as('trackArtist');
}

export function withTrackAlbum(
  eb: ExpressionBuilder<DB, 'program'>,
  fields: ProgramGroupingFields = AllProgramGroupingFields,
) {
  return jsonObjectFrom(
    eb
      .selectFrom('programGrouping')
      .select(fields)
      .whereRef('programGrouping.uuid', '=', 'program.albumUuid')
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

export function withProgramCustomShows(eb: ExpressionBuilder<DB, 'program'>) {
  return jsonArrayFrom(
    eb
      .selectFrom('customShowContent')
      .whereRef('customShowContent.contentUuid', '=', 'program.uuid')
      .innerJoin(
        'customShow',
        'customShowContent.customShowUuid',
        'customShow.uuid',
      )
      .select('customShow.uuid'),
  ).as('customShows');
}

export function withFillerShow(eb: ExpressionBuilder<DB, 'channelFillerShow'>) {
  return jsonObjectFrom(
    eb
      .selectFrom('fillerShow')
      .select(AllFillerShowFields)
      .whereRef('channelFillerShow.fillerShowUuid', '=', 'fillerShow.uuid')
      .innerJoin(
        'fillerShow',
        'channelFillerShow.fillerShowUuid',
        'fillerShow.uuid',
      ),
  ).as('fillerShow');
}

type ProgramJoins = {
  trackAlbum: boolean | ProgramGroupingFields;
  trackArtist: boolean | ProgramGroupingFields;
  tvShow: boolean | ProgramGroupingFields;
  tvSeason: boolean | ProgramGroupingFields;
  customShows: boolean;
};

const defaultProgramJoins: ProgramJoins = {
  trackAlbum: false,
  trackArtist: false,
  tvShow: false,
  tvSeason: false,
  customShows: false,
};

type ProgramFields = readonly `program.${keyof RawProgram}`[];

const AllProgramFields: ProgramFields = [
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
];

type WithProgramsOptions = {
  joins?: Partial<ProgramJoins>;
  fields?: ProgramFields;
};

const defaultWithProgramOptions: DeepRequired<WithProgramsOptions> = {
  joins: defaultProgramJoins,
  fields: AllProgramFields,
};

function baseWithProgamsExpressionBuilder(
  eb: ExpressionBuilder<
    DB,
    | 'channel'
    | 'channelPrograms'
    | 'channelFallback'
    | 'fillerShowContent'
    | 'fillerShow'
  >,
  opts: DeepRequired<WithProgramsOptions>,
) {
  return eb
    .selectFrom('program')
    .select(opts.fields)
    .$if(!!opts.joins.trackAlbum, (qb) =>
      qb.select((eb) =>
        withTrackAlbum(
          eb,
          isBoolean(opts.joins.trackAlbum)
            ? AllProgramGroupingFields
            : opts.joins.trackAlbum,
        ),
      ),
    )
    .$if(!!opts.joins.trackArtist, (qb) => qb.select(withTrackArtist))
    .$if(!!opts.joins.tvSeason, (qb) => qb.select(withTvSeason))
    .$if(!!opts.joins.tvSeason, (qb) => qb.select(withTvShow))
    .$if(!!opts.joins.customShows, (qb) => qb.select(withProgramCustomShows));
}

export function withPrograms(
  eb: ExpressionBuilder<DB, 'channel' | 'channelPrograms'>,
  options: WithProgramsOptions = defaultWithProgramOptions,
) {
  const mergedOpts = merge({}, defaultWithProgramOptions, options);
  return jsonArrayFrom(
    baseWithProgamsExpressionBuilder(eb, mergedOpts).innerJoin(
      'channelPrograms',
      (join) =>
        join
          .onRef('channelPrograms.programUuid', '=', 'program.uuid')
          .onRef('channel.uuid', '=', 'channelPrograms.channelUuid'),
    ),
  ).as('programs');
}

export function withFallbackPrograms(
  eb: ExpressionBuilder<DB, 'channelFallback' | 'channel'>,
  options: WithProgramsOptions = defaultWithProgramOptions,
) {
  const mergedOpts = merge({}, defaultWithProgramOptions, options);
  return jsonArrayFrom(
    baseWithProgamsExpressionBuilder(eb, mergedOpts).innerJoin(
      'channelFallback',
      (join) =>
        join
          .onRef('channelFallback.programUuid', '=', 'program.uuid')
          .onRef('channel.uuid', '=', 'channelFallback.channelUuid'),
    ),
  ).as('programs');
}

export function withFillerPrograms(
  eb: ExpressionBuilder<DB, 'fillerShow' | 'fillerShowContent'>,
  options: WithProgramsOptions = defaultWithProgramOptions,
) {
  const mergedOpts = merge({}, defaultWithProgramOptions, options);
  return jsonArrayFrom(
    baseWithProgamsExpressionBuilder(eb, mergedOpts)
      .select(['fillerShowContent.index'])
      .innerJoin('fillerShowContent', (join) =>
        join
          .onRef('fillerShowContent.programUuid', '=', 'program.uuid')
          .onRef('fillerShow.uuid', '=', 'fillerShowContent.fillerShowUuid'),
      ),
  ).as('fillerContent');
}
