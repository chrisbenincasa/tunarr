import { mapToObj } from '@/util/index.js';
import { seq } from '@tunarr/shared/util';
import { type TupleToUnion } from '@tunarr/types';
import { sql } from 'drizzle-orm';
import { toSnakeCase } from 'drizzle-orm/casing';
import type { ExpressionBuilder } from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/sqlite';
import { isUndefined } from 'lodash-es';
import type { DeepRequired, StrictExclude } from 'ts-essentials';
import type { Replace } from '../types/util.ts';
import type { FillerShowTable as RawFillerShow } from './schema/FillerShow.js';
import type { ProgramTable as RawProgram } from './schema/Program.ts';
import { ProgramType } from './schema/Program.ts';
import type { ProgramExternalId } from './schema/ProgramExternalId.ts';
import { ProgramExternalIdFieldsWithAlias } from './schema/ProgramExternalId.ts';
import type {
  ProgramGrouping,
  ProgramGroupingFields,
  ProgramGroupingUpdate,
} from './schema/ProgramGrouping.ts';
import type { ProgramGroupingExternalId } from './schema/ProgramGroupingExternalId.ts';
import { ProgramGroupingExternalIdFieldsWithAlias } from './schema/ProgramGroupingExternalId.ts';
import type { DB } from './schema/db.ts';

type ProgramGroupingExternalIdFields<
  Alias extends string = 'programGroupingExternalId',
> = readonly `${Alias}.${keyof ProgramGroupingExternalId}`[];

const ProgramGroupingExternalIdFields: (keyof ProgramGroupingExternalId)[] = [
  'externalKey',
  'externalSourceId',
  'mediaSourceId',
  'sourceType',
];

// TODO move this definition to the ProgramGrouping DAO file
export const AllProgramGroupingExternalIdFields: ProgramGroupingExternalIdFields =
  ProgramGroupingExternalIdFields.map(
    (key) => `programGroupingExternalId.${key}` as const,
  );

export const AllProgramGroupingExternalIdFieldsAliased = <Alias extends string>(
  alias: Alias,
): ProgramGroupingExternalIdFields<Alias> =>
  ProgramGroupingExternalIdFields.map((key) => `${alias}.${key}` as const);

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
    'mediaSourceId',
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
    'libraryId',
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
  programVersions: boolean;
};

const defaultProgramJoins: ProgramJoins = {
  trackAlbum: false,
  trackArtist: false,
  tvShow: false,
  tvSeason: false,
  customShows: false,
  programVersions: false,
};

export const AllProgramJoins: ProgramJoins = {
  trackAlbum: true,
  trackArtist: true,
  tvSeason: true,
  tvShow: true,
  customShows: true,
  programVersions: true,
};

type ProgramField = `program.${keyof RawProgram}`;
type ProgramFields = readonly ProgramField[];

export const AllProgramFields = [
  'program.uuid',
  'program.createdAt',
  'program.updatedAt',
  'program.albumName',
  'program.canonicalId',
  'program.icon',
  'program.summary',
  'program.title',
  'program.type',
  'program.year',
  'program.artistUuid',
  'program.externalKey',
  'program.libraryId',
  'program.albumUuid',
  'program.artistName',
  'program.duration',
  'program.episode',
  'program.episodeIcon',
  'program.externalSourceId',
  'program.filePath',
  'program.grandparentExternalKey',
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
  'program.tvShowUuid',
  'program.mediaSourceId',
  'program.localMediaFolderId',
  'program.localMediaSourcePathId',
  'program.state',
  'program.tagline',
  'program.plot',
] as const;

type ProgramUpsertFields = StrictExclude<
  Replace<ProgramField, 'program.', ''>,
  'uuid' | 'createdAt'
>;

const ProgramUpsertIgnoreFields = [
  'program.uuid',
  'program.createdAt',
  // 'program.tvShowUuid',
  // 'program.albumUuid',
  // 'program.artistUuid',
  // 'program.seasonUuid',
] as const;

type KnownProgramUpsertFields = StrictExclude<
  TupleToUnion<typeof AllProgramFields>,
  TupleToUnion<typeof ProgramUpsertIgnoreFields>
>;

export const ProgramUpsertFields: ProgramUpsertFields[] =
  AllProgramFields.filter(
    (f): f is KnownProgramUpsertFields =>
      !(ProgramUpsertIgnoreFields as ReadonlyArray<ProgramField>).includes(f),
  ).map((v) => v.replace('program.', '') as Replace<typeof v, 'program.', ''>);

export const ProgramUpsertSetClause = mapToObj(ProgramUpsertFields, (f) => ({
  [f]: sql`excluded.${sql.identifier(toSnakeCase(f))}`,
}));

type ProgramGroupingField = `programGrouping.${keyof ProgramGrouping}`;
type ProgramGroupingUpsertFields = StrictExclude<
  Replace<ProgramGroupingField, 'programGrouping', 'excluded'>,
  'excluded.uuid' | 'excluded.createdAt'
>;

export const AllProgramGroupingFields = [
  'programGrouping.uuid',
  'programGrouping.canonicalId',
  'programGrouping.createdAt',
  'programGrouping.updatedAt',
  'programGrouping.icon',
  'programGrouping.index',
  'programGrouping.summary',
  'programGrouping.title',
  'programGrouping.type',
  'programGrouping.year',
  'programGrouping.artistUuid',
  'programGrouping.showUuid',
  'programGrouping.libraryId',
  'programGrouping.sourceType',
  'programGrouping.mediaSourceId',
  'programGrouping.externalKey',
  'programGrouping.releaseDate',
  'programGrouping.rating',
  'programGrouping.tagline',
  'programGrouping.plot',
] as const;

const ProgramGroupingUpsertIgnoreFields = [
  'programGrouping.uuid',
  'programGrouping.createdAt',
] as const;

type KnownProgramGroupingUpsertFields = StrictExclude<
  TupleToUnion<typeof AllProgramGroupingFields>,
  TupleToUnion<typeof ProgramGroupingUpsertIgnoreFields>
>;

export function getProgramGroupingUpsertFields(
  update: ProgramGroupingUpdate,
): ProgramGroupingUpsertFields[] {
  const withoutExcluded = AllProgramGroupingFields.filter(
    (f): f is KnownProgramGroupingUpsertFields => {
      return !(
        ProgramGroupingUpsertIgnoreFields as ReadonlyArray<ProgramGroupingField>
      ).includes(f);
    },
  );

  return seq.collect(withoutExcluded, (field) => {
    const name = field.replace('programGrouping.', '') as Replace<
      KnownProgramGroupingUpsertFields,
      'programGrouping.',
      ''
    >;
    if (isUndefined(update[name])) {
      return;
    }
    return `excluded.${name}` as Replace<
      typeof field,
      'programGrouping',
      'excluded'
    >;
  });
}

export type WithProgramsOptions = {
  joins?: Partial<ProgramJoins>;
  fields?: ProgramFields;
  includeGroupingExternalIds?: boolean;
};

export const defaultWithProgramOptions: DeepRequired<WithProgramsOptions> = {
  joins: defaultProgramJoins,
  fields: AllProgramFields,
  includeGroupingExternalIds: false,
};
