import { isNonEmptyString, search } from '@tunarr/shared/util';
import { SmartCollection } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { SmartCollectionsDB } from '../../db/SmartCollectionsDB.ts';
import { KEYS } from '../../types/inject.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import Fixer from './fixer.ts';

@injectable()
export class FixSmartCollectionFilters extends Fixer {
  constructor(
    @inject(KEYS.Logger) protected logger: Logger,
    @inject(SmartCollectionsDB) private smartCollectionDB: SmartCollectionsDB,
    @inject(search.SearchParser) private searchParser: search.SearchParser,
  ) {
    super();
  }

  protected async runInternal(): Promise<void> {
    const allCollections = await this.smartCollectionDB.getAllRaw();

    for (const collection of allCollections) {
      if (!isNonEmptyString(collection.filter)) {
        continue;
      }

      const tokenized = search.tokenizeSearchQuery(collection.filter);
      this.searchParser.reset();
      this.searchParser.input = tokenized.tokens;
      this.searchParser.searchExpression();
      // This collection needs fixing
      if (this.searchParser.errors.length > 0) {
        if (isNonEmptyString(collection.keywords)) {
          this.logger.warn(
            'Collection %s has keywords set but an unparseable filter. It will not work as expected.',
            collection.name,
          );
          continue;
        }

        this.logger.debug(
          'Updating smart collection %s which had an unparseable filter',
          collection.name,
        );

        const newColl: SmartCollection = {
          ...collection,
          keywords: collection.filter,
          filter: undefined,
        };

        await this.smartCollectionDB.update(collection.uuid, newColl);
      }
    }
  }
}
