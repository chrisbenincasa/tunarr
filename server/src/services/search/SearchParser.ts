import type { SearchFilter } from '@tunarr/types/schemas';
import { inject, injectable, LazyServiceIdentifier } from 'inversify';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import { LibraryNameSearchMutator } from './LibraryNameSearchMutator.ts';
import { MediaSourceNameSearchMutator } from './MediaSourceNameSearchMutator.ts';
import type { SearchFilterValueMutator } from './SearchFilterValueMutator.ts';
import { SummarySearchMutator } from './SummarySearchMutator.ts';

@injectable()
export class SearchParser {
  constructor(
    @inject(new LazyServiceIdentifier(() => MediaSourceDB))
    private mediaSourceDB: MediaSourceDB,
  ) {}

  async preprocessSearchFilter(filter: SearchFilter): Promise<SearchFilter> {
    const allMediaSources = await this.mediaSourceDB.getAll();
    const mutators = [
      new MediaSourceNameSearchMutator(allMediaSources),
      new LibraryNameSearchMutator(
        allMediaSources.flatMap((ms) => ms.libraries),
      ),
      new SummarySearchMutator(),
    ];

    return this.preprocessSearchFilterInner(filter, mutators);
  }

  private preprocessSearchFilterInner(
    filter: SearchFilter,
    operators: SearchFilterValueMutator[],
  ): SearchFilter {
    if (operators.length === 0) {
      return filter;
    }

    switch (filter.type) {
      case 'op': {
        filter.children = filter.children.map((child) =>
          this.preprocessSearchFilterInner(child, operators),
        );
        return filter;
      }
      case 'value': {
        let newOp: SearchFilter = filter;
        for (const op of operators) {
          if (newOp.type !== 'value' || !op.appliesTo(newOp)) {
            continue;
          }
          newOp = op.mutate(newOp);
        }
        return newOp;
      }
    }
  }
}
