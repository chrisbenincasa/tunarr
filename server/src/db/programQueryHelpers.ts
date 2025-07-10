import { type TupleToUnion } from '@tunarr/types';
import type {
  CaseWhenBuilder,
  ExpressionBuilder,
  Kysely,
  Selection,
  SelectQueryBuilder,
  UpdateQueryBuilder,
  UpdateResult,
} from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/sqlite';
import { identity, isBoolean, isEmpty, keys, merge, reduce } from 'lodash-es';
import type { DeepPartial, DeepRequired, StrictExclude } from 'ts-essentials';
import type { FillerShowTable as RawFillerShow } from './schema/FillerShow.js';
import type {
  ProgramDao,
  ProgramTable as RawProgram,
} from './schema/Program.ts';
import { ProgramType } from './schema/Program.ts';
import type { ProgramExternalId } from './schema/ProgramExternalId.ts';
import { ProgramExternalIdFieldsWithAlias } from './schema/ProgramExternalId.ts';
import {
  ProgramGroupingType,
  type ProgramGroupingTable as RawProgramGrouping,
} from './schema/ProgramGrouping.ts';
import type { ProgramGroupingExternalId } from './schema/ProgramGroupingExternalId.ts';
import { ProgramGroupingExternalIdFieldsWithAlias } from './schema/ProgramGroupingExternalId.ts';
import type { DB } from './schema/db.ts';

type ProgramGroupingFields<Alias extends string = 'programGrouping'> =
  readonly `${Alias}.${keyof RawProgramGrouping}`[];

const ProgramGroupingKeys: (keyof RawProgramGrouping)[] = [
  'artistUuid',
  'createdAt',
  'icon',
  'index',
  'showUuid',
  'summary',
  'title',
  'type',
  'updatedAt',
  'uuid',
  'year',
];

// TODO move this definition to the ProgramGrouping DAO file
export const AllProgramGroupingFields: ProgramGroupingFields =
  ProgramGroupingKeys.map((key) => `programGrouping.${key}` as const);

export const AllProgramGroupingFieldsAliased = <Alias extends string>(
  alias: Alias,
): ProgramGroupingFields<Alias> =>
  ProgramGroupingKeys.map((key) => `${alias}.${key}` as const);

export const MinimalProgramGroupingFields: ProgramGroupingFields = [
  'programGrouping.uuid',
  'programGrouping.title',
  'programGrouping.year',
  // 'programGrouping.index',
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
  includeExternalIds: boolean = false,
) {
  return jsonObjectFrom(
    eb
      .selectFrom('programGrouping')
      .select(fields)
      .$if(includeExternalIds, (qb) =>
        qb.select((eb) => withProgramGroupingExternalIds(eb)),
      )
      .whereRef('programGrouping.uuid', '=', 'program.tvShowUuid')
      .where('program.type', '=', ProgramType.Episode)
      .orderBy('uuid'),
  ).as('tvShow');
}

export function withTvSeason(
  eb: ExpressionBuilder<DB, 'program'>,
  fields: ProgramGroupingFields = AllProgramGroupingFields,
  includeExternalIds: boolean = false,
) {
  return jsonObjectFrom(
    eb
      .selectFrom('programGrouping')
      .select(fields)
      .$if(includeExternalIds, (qb) =>
        qb.select((eb) => withProgramGroupingExternalIds(eb)),
      )
      .whereRef('programGrouping.uuid', '=', 'program.seasonUuid')
      .where('program.type', '=', ProgramType.Episode)
      .orderBy('uuid'),
  ).as('tvSeason');
}

export function withTvShowSeasons(
  eb: ExpressionBuilder<DB, 'programGrouping'>,
  fields: ProgramGroupingFields<'season'> = AllProgramGroupingFieldsAliased(
    'season',
  ),
  includeExternalIds: boolean = false,
) {
  return jsonArrayFrom(
    eb
      .selectFrom('programGrouping as season')
      .select(fields)
      .$if(includeExternalIds, (qb) =>
        qb.select((eb) => withProgramGroupingExternalIds(eb)),
      )
      .whereRef('programGrouping.uuid', '=', 'season.showUuid')
      .where('season.type', '=', ProgramGroupingType.Season)
      .orderBy(['season.index asc', 'season.uuid asc']),
  ).as('seasons');
}

export function withMusicArtistAlbums(
  eb: ExpressionBuilder<DB, 'programGrouping'>,
  fields: ProgramGroupingFields<'album'> = AllProgramGroupingFieldsAliased(
    'album',
  ),
  includeExternalIds: boolean = false,
) {
  return jsonArrayFrom(
    eb
      .selectFrom('programGrouping as album')
      .select(fields)
      .$if(includeExternalIds, (qb) =>
        qb.select((eb) => withProgramGroupingExternalIds(eb)),
      )
      .whereRef('programGrouping.uuid', '=', 'album.showUuid')
      .where('album.type', '=', ProgramGroupingType.Album)
      .orderBy(['album.index asc', 'album.uuid asc']),
  ).as('albums');
}

export function withTrackArtist(
  eb: ExpressionBuilder<DB, 'program'>,
  fields: ProgramGroupingFields = AllProgramGroupingFields,
  includeExternalIds: boolean = false,
) {
  return jsonObjectFrom(
    eb
      .selectFrom('programGrouping')
      .select(fields)
      .$if(includeExternalIds, (qb) =>
        qb.select((eb) => withProgramGroupingExternalIds(eb)),
      )
      .whereRef('programGrouping.uuid', '=', 'program.artistUuid')
      .where('program.type', '=', ProgramType.Track)
      .orderBy('uuid'),
  ).as('trackArtist');
}

export function withTrackAlbum(
  eb: ExpressionBuilder<DB, 'program'>,
  fields: ProgramGroupingFields = AllProgramGroupingFields,
  includeExternalIds: boolean = false,
) {
  return jsonObjectFrom(
    eb
      .selectFrom('programGrouping')
      .select(fields)
      .$if(includeExternalIds, (qb) =>
        qb.select((eb) => withProgramGroupingExternalIds(eb)),
      )
      .whereRef('programGrouping.uuid', '=', 'program.albumUuid')
      .where('program.type', '=', ProgramType.Track)
      .orderBy('uuid'),
  ).as('trackAlbum');
}

export function withProgramExternalIds(
  eb: ExpressionBuilder<DB, 'program'>,
  externalIdFields: (keyof ProgramExternalId)[] = [
    'externalKey',
    'sourceType',
    'externalSourceId',
  ],
) {
  return jsonArrayFrom(
    eb
      .selectFrom('programExternalId as eid')
      .select(ProgramExternalIdFieldsWithAlias(externalIdFields, 'eid'))
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

export function withProgramGroupingExternalIds(
  eb: ExpressionBuilder<DB, 'programGrouping'>,
  externalIdFields: (keyof ProgramGroupingExternalId)[] = [
    'externalKey',
    'sourceType',
    'externalSourceId',
    'mediaSourceId',
  ],
) {
  return jsonArrayFrom(
    eb
      .selectFrom('programGroupingExternalId as eid')
      .select(ProgramGroupingExternalIdFieldsWithAlias(externalIdFields, 'eid'))
      .whereRef('eid.groupUuid', '=', 'programGrouping.uuid'),
  ).as('externalIds');
}

export type ProgramJoins = {
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

export const AllProgramJoins: ProgramJoins = {
  trackAlbum: true,
  trackArtist: true,
  tvSeason: true,
  tvShow: true,
  customShows: true,
};

type Replace<
  T extends string,
  S extends string,
  D extends string,
  A extends string = '',
> = T extends `${infer L}${S}${infer R}`
  ? Replace<R, S, D, `${A}${L}${D}`>
  : `${A}${T}`;

type ProgramField = `program.${keyof RawProgram}`;
type ProgramFields = readonly ProgramField[];

// const ProgramUpsertMapping =

export const AllProgramFields: ProgramFields = [
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

type ProgramUpsertFields = StrictExclude<
  Replace<ProgramField, 'program', 'excluded'>,
  'excluded.uuid' | 'excluded.createdAt'
>;

const ProgramUpsertIgnoreFields = [
  'program.uuid',
  'program.createdAt',
  'program.tvShowUuid',
  'program.albumUuid',
  'program.artistUuid',
  'program.seasonUuid',
] as const;

type KnownProgramUpsertFields = StrictExclude<
  TupleToUnion<typeof AllProgramFields>,
  TupleToUnion<typeof ProgramUpsertIgnoreFields>
>;

export const ProgramUpsertFields: ProgramUpsertFields[] =
  AllProgramFields.filter(
    (f): f is KnownProgramUpsertFields =>
      !(ProgramUpsertIgnoreFields as ReadonlyArray<ProgramField>).includes(f),
  ).map(
    (v) =>
      v.replace('program.', 'excluded.') as Replace<
        typeof v,
        'program',
        'excluded'
      >,
  );

export type WithProgramsOptions = {
  joins?: Partial<ProgramJoins>;
  fields?: ProgramFields;
};

export const defaultWithProgramOptions: DeepRequired<WithProgramsOptions> = {
  joins: defaultProgramJoins,
  fields: AllProgramFields,
};

type BaseWithProgramsAvailableTables =
  | 'channel'
  | 'channelPrograms'
  | 'channelFallback'
  | 'fillerShowContent'
  | 'fillerShow'
  | 'customShow'
  | 'customShowContent'
  | 'programExternalId';

function baseWithProgramsExpressionBuilder(
  eb: ExpressionBuilder<DB, BaseWithProgramsAvailableTables>,
  opts: DeepRequired<WithProgramsOptions>,
  builderFunc: (
    qb: SelectQueryBuilder<
      DB,
      BaseWithProgramsAvailableTables | 'program',
      ProgramDao
    >,
  ) => SelectQueryBuilder<
    DB,
    BaseWithProgramsAvailableTables | 'program',
    ProgramDao
  > = identity,
) {
  const builder = eb.selectFrom('program').select(opts.fields);

  return builderFunc(builder)
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

// TODO: See if there is a way to share the impls here and above
export function selectProgramsBuilder(
  db: Kysely<DB>,
  optOverides: DeepPartial<WithProgramsOptions> = defaultWithProgramOptions,
  builderFunc: (
    qb: SelectQueryBuilder<DB, 'program', Selection<DB, 'program', ProgramDao>>,
  ) => SelectQueryBuilder<DB, 'program', ProgramDao> = identity,
) {
  const opts: DeepRequired<WithProgramsOptions> = merge(
    {},
    defaultWithProgramOptions,
    optOverides,
  );
  const builder = db.selectFrom('program').select(opts.fields);

  return builderFunc(builder)
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
  builderFunc: (
    qb: SelectQueryBuilder<
      DB,
      BaseWithProgramsAvailableTables | 'program',
      ProgramDao
    >,
  ) => SelectQueryBuilder<
    DB,
    BaseWithProgramsAvailableTables | 'program',
    ProgramDao
  > = identity,
) {
  const mergedOpts = merge({}, defaultWithProgramOptions, options);
  return jsonArrayFrom(
    baseWithProgramsExpressionBuilder(eb, mergedOpts, builderFunc).innerJoin(
      'channelPrograms',
      (join) =>
        join
          .onRef('channelPrograms.programUuid', '=', 'program.uuid')
          .onRef('channel.uuid', '=', 'channelPrograms.channelUuid'),
    ),
  ).as('programs');
}

export function withProgramByExternalId(
  eb: ExpressionBuilder<DB, 'programExternalId'>,
  options: WithProgramsOptions = defaultWithProgramOptions,
) {
  const mergedOpts = merge({}, defaultWithProgramOptions, options);
  return jsonObjectFrom(
    baseWithProgramsExpressionBuilder(eb, mergedOpts).whereRef(
      'programExternalId.programUuid',
      '=',
      'program.uuid',
    ),
  ).as('program');
}

export function withProgramChannels(eb: ExpressionBuilder<DB, 'program'>) {
  return jsonArrayFrom(
    eb
      .selectFrom('channelPrograms')
      .whereRef('channelPrograms.programUuid', '=', 'program.uuid')
      .innerJoin('channel', 'channel.uuid', 'channelPrograms.channelUuid')
      .select(['channel.uuid', 'channel.name', 'channel.number']),
  ).as('channels');
}

export function withProgramFillerShows(eb: ExpressionBuilder<DB, 'program'>) {
  return jsonArrayFrom(
    eb
      .selectFrom('fillerShowContent')
      .whereRef('fillerShowContent.programUuid', '=', 'program.uuid')
      .innerJoin(
        'fillerShow',
        'fillerShow.uuid',
        'fillerShowContent.fillerShowUuid',
      )
      .select(['fillerShow.uuid']),
  ).as('fillerShows');
}

export function withFallbackPrograms(
  eb: ExpressionBuilder<DB, 'channelFallback' | 'channel'>,
  options: WithProgramsOptions = defaultWithProgramOptions,
) {
  const mergedOpts = merge({}, defaultWithProgramOptions, options);
  return jsonArrayFrom(
    baseWithProgramsExpressionBuilder(eb, mergedOpts).innerJoin(
      'channelFallback',
      (join) => join.onRef('channelFallback.programUuid', '=', 'program.uuid'),
    ),
  ).as('programs');
}

export function withFillerPrograms(
  eb: ExpressionBuilder<DB, 'fillerShow' | 'fillerShowContent'>,
  options: WithProgramsOptions = defaultWithProgramOptions,
) {
  const mergedOpts = merge({}, defaultWithProgramOptions, options);
  return jsonArrayFrom(
    baseWithProgramsExpressionBuilder(eb, mergedOpts)
      .select(['fillerShowContent.index'])
      .orderBy('fillerShowContent.index asc')
      .innerJoin('fillerShowContent', (join) =>
        join
          .onRef('fillerShowContent.programUuid', '=', 'program.uuid')
          .onRef('fillerShow.uuid', '=', 'fillerShowContent.fillerShowUuid'),
      ),
  ).as('fillerContent');
}

export function withCustomShowPrograms(
  eb: ExpressionBuilder<DB, 'customShow' | 'customShowContent'>,
  options: WithProgramsOptions = defaultWithProgramOptions,
) {
  const mergedOpts = merge({}, defaultWithProgramOptions, options);
  return jsonArrayFrom(
    baseWithProgramsExpressionBuilder(eb, mergedOpts)
      .select(['customShowContent.index as index'])
      .orderBy('customShowContent.index asc')
      .innerJoin('customShowContent', (join) =>
        join
          .onRef('customShowContent.contentUuid', '=', 'program.uuid')
          .onRef('customShow.uuid', '=', 'customShowContent.customShowUuid'),
      ),
  ).as('customShowContent');
}

type ProgramRelationCaseBuilder = CaseWhenBuilder<
  DB,
  'program',
  unknown,
  string | null
>;

export function updateProgramTvShowIds(
  builder: UpdateQueryBuilder<DB, 'program', 'program', UpdateResult>,
  mappings: Record<string, string>,
) {
  const programIds = keys(mappings);
  if (isEmpty(programIds)) {
    return builder;
  }
  return builder.$if(!isEmpty(programIds), (_) =>
    _.set((eb) => ({
      tvShowUuid: reduce(
        [...programIds],
        (acc, curr) => acc.when('program.uuid', '=', curr).then(mappings[curr]),
        eb.case() as unknown as ProgramRelationCaseBuilder,
      )
        .else(eb.ref('program.tvShowUuid'))
        .end(),
    })),
  );
}
