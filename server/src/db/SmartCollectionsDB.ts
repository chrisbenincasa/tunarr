import { isNonEmptyString, search } from '@tunarr/shared/util';
import { SearchFilter } from '@tunarr/types/api';
import { Mutex } from 'async-mutex';
import dayjs from 'dayjs';
import { eq } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { head } from 'lodash-es';
import NodeCache from 'node-cache';
import { StrictOmit } from 'ts-essentials';
import { v4 } from 'uuid';
import { SearchClause } from '../../../shared/dist/src/util/searchUtil.js';
import {
  MeilisearchService,
  ProgramSearchDocument,
} from '../services/MeilisearchService.ts';
import { KEYS } from '../types/inject.ts';
import { Result } from '../types/result.ts';
import { DrizzleDBAccess } from './schema/index.ts';
import {
  NewSmartCollection,
  SmartCollection,
} from './schema/SmartCollection.ts';

@injectable()
export class SmartCollectionsDB {
  private static cache: NodeCache = new NodeCache({
    deleteOnExpire: true,
    stdTTL: dayjs.duration({ hours: 1 }).asSeconds(),
    checkperiod: dayjs.duration({ minutes: 1 }).asSeconds(),
  });
  private mu: Mutex = new Mutex();

  constructor(
    @inject(KEYS.DrizzleDB) private db: DrizzleDBAccess,
    @inject(search.SearchParser) private searchParser: search.SearchParser,
    @inject(MeilisearchService) private searchService: MeilisearchService,
  ) {}

  async getAll() {
    return await this.db.query.smartCollection.findMany();
  }

  async getById(id: string) {
    return await this.db.query.smartCollection.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, id),
    });
  }

  async getByIds(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }

    return await this.db.query.smartCollection.findMany({
      where: (fields, { inArray }) => inArray(fields.uuid, ids),
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
    const parseResult = await this.parseSearchQueryString(collection.query);

    parseResult.forEach((searchClause) => {
      SmartCollectionsDB.cache.set(
        collection.query,
        search.parsedSearchToRequest(searchClause),
      );
    });

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
      const query = collection.query;
      const parseResult = await this.parseSearchQueryString(query);
      parseResult.forEach((searchClause) => {
        SmartCollectionsDB.cache.set(
          query,
          search.parsedSearchToRequest(searchClause),
        );
      });
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

  async materializeSmartCollection(
    id: string,
    failOnNotFound: boolean = false,
  ) {
    const maybeCollection = await this.db.query.smartCollection.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, id),
    });

    if (!maybeCollection) {
      if (failOnNotFound) {
        throw new Error(`Smart collection ID = ${id} not found!`);
      } else {
        return [];
      }
    }

    let searchFilter = SmartCollectionsDB.cache.get<SearchFilter>(
      maybeCollection.query,
    );
    if (!searchFilter) {
      const parseResult = await this.parseSearchQueryString(
        maybeCollection.query,
      );

      if (parseResult.isSuccess()) {
        searchFilter = search.parsedSearchToRequest(parseResult.get());
        SmartCollectionsDB.cache.set(maybeCollection.query, searchFilter);
      }
    }

    let page = searchFilter ? 0 : 1;
    const results: ProgramSearchDocument[] = [];
    for (;;) {
      const pageResult = await this.searchService.search('programs', {
        paging: { page, limit: 100 },
        query: searchFilter ? null : maybeCollection.query,
        filter: searchFilter ? searchFilter : null,
      });
      if (pageResult.results.length === 0) {
        break;
      }
      results.push(...pageResult.results);
      page++;
    }

    return results;
  }

  private async parseSearchQueryString(
    queryString: string,
  ): Promise<Result<SearchClause>> {
    const tokenized = search.tokenizeSearchQuery(queryString);
    if (tokenized.errors.length > 0) {
      return Result.forError(
        new Error(
          `Could not tokenize search query when creating smart collection. \n${tokenized.errors.map((err) => err.message).join('\n')}`,
        ),
      );
    }

    const clause = await this.mu.runExclusive(() => {
      this.searchParser.reset();
      this.searchParser.input = tokenized.tokens;
      return this.searchParser.searchExpression();
    });

    if (this.searchParser.errors.length > 0) {
      return Result.forError(
        new Error(
          `Could not parse search query when creating smart collection. \n${this.searchParser.errors.map((err) => err.message).join('\n')}`,
        ),
      );
    }

    return Result.success(clause);
  }
}
