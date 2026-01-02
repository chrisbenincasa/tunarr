import { eq } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { KEYS } from '../types/inject.ts';
import { MediaSourceId } from './schema/base.ts';
import {
  ExternalCollection,
  NewExternalCollection,
} from './schema/ExternalCollection.ts';
import { DrizzleDBAccess } from './schema/index.ts';

@injectable()
export class ExternalCollectionRepo {
  constructor(
    @inject(KEYS.DrizzleDB)
    private drizzleDB: DrizzleDBAccess,
  ) {}

  insertCollection(coll: NewExternalCollection) {
    return this.drizzleDB.insert(ExternalCollection).values(coll).execute();
  }

  getById(id: string) {
    return this.drizzleDB.query.externalCollections
      .findFirst({
        where: (fields, { eq }) => eq(fields.uuid, id),
        with: {
          groupings: {
            columns: {},
            with: {
              grouping: true,
            },
          },
          programs: {
            columns: {},
            with: {
              program: true,
            },
          },
        },
      })
      .execute();
  }

  deleteCollection(id: string) {
    return this.drizzleDB
      .delete(ExternalCollection)
      .where(eq(ExternalCollection.uuid, id))
      .execute();
  }

  getByMediaSourceId(mediaSourceId: MediaSourceId) {
    return this.drizzleDB.query.externalCollections
      .findMany({
        where: (fields, operators) =>
          operators.eq(fields.mediaSourceId, mediaSourceId),
      })
      .execute();
  }

  getByLibraryId(libraryId: string) {
    return this.drizzleDB.query.externalCollections
      .findMany({
        where: (fields, { eq }) => eq(fields.libraryId, libraryId),
      })
      .execute();
  }

  getCollectionByExternalId(mediaSourceId: MediaSourceId, externalKey: string) {
    return this.drizzleDB.query.externalCollections
      .findFirst({
        where: (fields, { eq, and }) =>
          and(
            eq(fields.externalKey, externalKey),
            eq(fields.mediaSourceId, mediaSourceId),
          ),
      })
      .execute();
  }

  async getCollectionPrograms(collectionId: string) {
    const joins =
      await this.drizzleDB.query.externalCollectionPrograms.findMany({
        where: (fields, { eq }) => eq(fields.collectionId, collectionId),
        columns: {},
        with: {
          program: {
            with: {
              externalIds: true,
            },
          },
        },
      });
    return joins.map((j) => j.program);
  }

  async getCollectionProgramGroupings(collectionId: string) {
    const joins =
      await this.drizzleDB.query.externalCollectionPrograms.findMany({
        where: (fields, { eq }) => eq(fields.collectionId, collectionId),
        columns: {},
        with: {
          grouping: {
            with: {
              externalIds: true,
            },
          },
        },
      });
    return joins.map((j) => j.grouping);
  }
}
