import { MediaSourceId } from '@tunarr/shared';
import { seq } from '@tunarr/shared/util';
import { inject, injectable } from 'inversify';
import { chunk } from 'lodash-es';
import { MarkRequired } from 'ts-essentials';
import { KEYS } from '../types/inject.ts';
import { RemoteSourceType } from './schema/base.ts';
import { ProgramGroupingOrmWithRelations } from './schema/derivedTypes.ts';
import { DrizzleDBAccess } from './schema/index.ts';

@injectable()
export class ProgramGroupingDB {
  constructor(@inject(KEYS.DrizzleDB) private db: DrizzleDBAccess) {}

  async lookupByExternalIds(
    ids:
      | Set<[RemoteSourceType, MediaSourceId, string]>
      | Set<readonly [RemoteSourceType, MediaSourceId, string]>,
    chunkSize: number = 200,
  ) {
    const allIds = [...ids];
    const programs: MarkRequired<
      ProgramGroupingOrmWithRelations,
      'externalIds'
    >[] = [];
    for (const idChunk of chunk(allIds, chunkSize)) {
      const results = await this.db.query.programGroupingExternalId.findMany({
        where: (fields, { or, and, eq }) => {
          const ands = idChunk.map(([ps, es, ek]) =>
            and(
              eq(fields.externalKey, ek),
              eq(fields.sourceType, ps),
              eq(fields.mediaSourceId, es),
            ),
          );
          return or(...ands);
        },
        columns: {},
        with: {
          grouping: {
            with: {
              artist: true,
              show: true,
              externalIds: true,
              tags: {
                with: {
                  tag: true,
                },
              },
              artwork: true,
              credits: true,
              genres: {
                with: {
                  genre: true,
                },
              },
              studios: {
                with: {
                  studio: true,
                },
              },
            },
          },
        },
      });
      programs.push(...seq.collect(results, (r) => r.grouping));
    }

    return programs;
  }
}
