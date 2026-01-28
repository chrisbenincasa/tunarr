import { isNonEmptyString, search } from '@tunarr/shared/util';
import { SmartCollection as SmartCollectionDto } from '@tunarr/types';
import { SearchFilter } from '@tunarr/types/schemas';
import { Mutex } from 'async-mutex';
import dayjs from 'dayjs';
import { eq } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { head } from 'lodash-es';
import NodeCache from 'node-cache';
import { StrictOmit } from 'ts-essentials';
import { v4 } from 'uuid';
import {
  MeilisearchService,
  ProgramSearchDocument,
} from '../services/MeilisearchService.ts';
import { KEYS } from '../types/inject.ts';
import { Result } from '../types/result.ts';
import { Maybe } from '../types/util.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import { DrizzleDBAccess } from './schema/index.ts';
import { SmartCollection } from './schema/SmartCollection.ts';

@injectable()
export class SmartCollectionsDB {
  private static cache: NodeCache = new NodeCache({
    deleteOnExpire: true,
    stdTTL: dayjs.duration({ hours: 1 }).asSeconds(),
    checkperiod: dayjs.duration({ minutes: 1 }).asSeconds(),
  });
  private mu: Mutex = new Mutex();

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.DrizzleDB) private db: DrizzleDBAccess,
    @inject(search.SearchParser) private searchParser: search.SearchParser,
    @inject(MeilisearchService) private searchService: MeilisearchService,
  ) {}

  async getAll() {
    const collections = await this.db.query.smartCollection.findMany();
    return Promise.all(
      collections.map((coll) => this.convertSmartCollectionDao(coll)),
    );
  }

  async getAllRaw() {
    return await this.db.query.smartCollection.findMany();
  }

  async getById(id: string): Promise<Maybe<SmartCollectionDto>> {
    const smartCollection = await this.db.query.smartCollection.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, id),
    });

    if (!smartCollection) {
      return;
    }

    return this.convertSmartCollectionDao(smartCollection);
  }

  private async convertSmartCollectionDao(
    smartCollection: SmartCollection,
  ): Promise<SmartCollectionDto> {
    let searchFilter: Maybe<SearchFilter>;
    if (isNonEmptyString(smartCollection.filter)) {
      searchFilter = SmartCollectionsDB.cache.get<SearchFilter>(
        smartCollection.filter,
      );
      if (!searchFilter) {
        const parseResult = await this.parseSearchQueryString(
          smartCollection.filter,
        );
        if (parseResult.isFailure()) {
          this.logger.warn(
            'Smart collection ID %s (%s) has unparseable filter ("%s"). Results will be wrong.',
            smartCollection.uuid,
            smartCollection.name,
            smartCollection.filter,
          );
        } else {
          searchFilter = parseResult.get();
        }
      }
    }

    return {
      ...smartCollection,
      filter: searchFilter,
      keywords: isNonEmptyString(smartCollection.keywords)
        ? smartCollection.keywords
        : '',
    };
  }

  async getByIds(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }

    const colls = await this.db.query.smartCollection.findMany({
      where: (fields, { inArray }) => inArray(fields.uuid, ids),
    });

    return Promise.all(
      colls.map((coll) => this.convertSmartCollectionDao(coll)),
    );
  }

  async delete(id: string) {
    return await this.db
      .delete(SmartCollection)
      .where(eq(SmartCollection.uuid, id));
  }

  async insert(
    collection: StrictOmit<SmartCollectionDto, 'uuid'>,
  ): Promise<Result<SmartCollectionDto>> {
    const insertResult = await Result.attemptAsync(() =>
      this.db
        .insert(SmartCollection)
        .values({
          uuid: v4(),
          keywords: collection.keywords,
          name: collection.name,
          filter: collection.filter
            ? search.searchFilterToString(collection.filter)
            : null,
        })
        .returning(),
    ).then((_) => _.map((r) => head(r)!));

    return insertResult.mapAsync((insert) => {
      return this.convertSmartCollectionDao(insert);
    });
  }

  async update(
    id: string,
    collection: Partial<SmartCollectionDto>,
  ): Promise<Result<SmartCollectionDto>> {
    return (
      await Result.attemptAsync(() =>
        this.db
          .update(SmartCollection)
          .set({
            name: collection.name,
            filter: collection.filter
              ? search.searchFilterToString(collection.filter)
              : null,
            keywords: collection.keywords,
          })
          .where(eq(SmartCollection.uuid, id))
          .returning(),
      ).then((_) => _.map((r) => head(r)!))
    ).mapAsync((updated) => this.convertSmartCollectionDao(updated));
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

    let searchFilter: Maybe<SearchFilter>;
    if (maybeCollection.filter) {
      searchFilter = SmartCollectionsDB.cache.get<SearchFilter>(
        maybeCollection.filter,
      );
      if (!searchFilter) {
        const parseResult = await this.parseSearchQueryString(
          maybeCollection.filter,
        );

        if (parseResult.isSuccess()) {
          const filter = parseResult.get();
          if (filter) {
            searchFilter = filter;
            SmartCollectionsDB.cache.set(maybeCollection.filter, searchFilter);
          }
        }
      }
    }

    let page = isNonEmptyString(maybeCollection.keywords) ? 1 : 0;
    const results: ProgramSearchDocument[] = [];
    for (;;) {
      const pageResult = await this.searchService.search('programs', {
        paging: { page, limit: 100 },
        query: searchFilter ? null : maybeCollection.filter,
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
  ): Promise<Result<Maybe<SearchFilter>>> {
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

    SmartCollectionsDB.cache.set(
      queryString,
      search.parsedSearchToRequest(clause),
    );

    return Result.success(search.parsedSearchToRequest(clause));
  }
}
