import { isNonEmptyString, search } from '@tunarr/shared/util';
import { Mutex } from 'async-mutex';
import { eq } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { head } from 'lodash-es';
import { StrictOmit } from 'ts-essentials';
import { v4 } from 'uuid';
import { KEYS } from '../types/inject.ts';
import { Result } from '../types/result.ts';
import { DrizzleDBAccess } from './schema/index.ts';
import {
  NewSmartCollection,
  SmartCollection,
} from './schema/SmartCollection.ts';

@injectable()
export class SmartCollectionsDB {
  private mu: Mutex = new Mutex();

  constructor(
    @inject(KEYS.DrizzleDB) private db: DrizzleDBAccess,
    @inject(search.SearchParser) private searchParser: search.SearchParser,
  ) {}

  async getAll() {
    return await this.db.query.smartCollection.findMany();
  }

  async getById(id: string) {
    return await this.db.query.smartCollection.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, id),
    });
  }

  async delete(id: string) {
    return await this.db
      .delete(SmartCollection)
      .where(eq(SmartCollection.uuid, id));
  }

  async insert(
    collection: StrictOmit<NewSmartCollection, 'uuid'>,
  ): Promise<Result<SmartCollection>> {
    const tokenized = search.tokenizeSearchQuery(collection.query);
    if (tokenized.errors.length > 0) {
      return Result.forError(
        new Error(
          `Could not tokenize search query when creating smart collection. \n${tokenized.errors.map((err) => err.message).join('\n')}`,
        ),
      );
    }

    await this.mu.runExclusive(() => {
      this.searchParser.reset();
      this.searchParser.input = tokenized.tokens;
      this.searchParser.searchExpression();
    });

    if (this.searchParser.errors.length > 0) {
      return Result.forError(
        new Error(
          `Could not parse search query when creating smart collection. \n${this.searchParser.errors.map((err) => err.message).join('\n')}`,
        ),
      );
    }

    return await Result.attemptAsync(() =>
      this.db
        .insert(SmartCollection)
        .values({
          ...collection,
          uuid: v4(),
        })
        .returning(),
    ).then((_) => _.map((r) => head(r)!));
  }

  async update(id: string, collection: Partial<NewSmartCollection>) {
    if (isNonEmptyString(collection.query)) {
      const tokenized = search.tokenizeSearchQuery(collection.query);
      if (tokenized.errors.length > 0) {
        return Result.forError(
          new Error(
            `Could not tokenize search query when creating smart collection. \n${tokenized.errors.map((err) => err.message).join('\n')}`,
          ),
        );
      }

      await this.mu.runExclusive(() => {
        this.searchParser.reset();
        this.searchParser.input = tokenized.tokens;
        this.searchParser.searchExpression();
      });

      if (this.searchParser.errors.length > 0) {
        return Result.forError(
          new Error(
            `Could not parse search query when creating smart collection. \n${this.searchParser.errors.map((err) => err.message).join('\n')}`,
          ),
        );
      }
    }

    return await Result.attemptAsync(() =>
      this.db
        .update(SmartCollection)
        .set({
          name: collection.name,
          query: collection.query,
        })
        .where(eq(SmartCollection.uuid, id))
        .returning(),
    ).then((_) => _.map((r) => head(r)!));
  }
}
