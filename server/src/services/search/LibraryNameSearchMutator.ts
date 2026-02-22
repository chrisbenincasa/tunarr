import { seq } from '@tunarr/shared/util';
import type { SearchFilterValueNode } from '@tunarr/types/schemas';
import type { Dictionary } from 'ts-essentials';
import type { MediaSourceLibraryOrm } from '../../db/schema/MediaSourceLibrary.ts';
import { groupByUniq } from '../../util/index.ts';
import type { SearchFilterValueMutator } from './SearchFilterValueMutator.ts';

export class LibraryNameSearchMutator implements SearchFilterValueMutator {
  private byName!: Dictionary<MediaSourceLibraryOrm>;

  constructor(libraries: MediaSourceLibraryOrm[]) {
    this.byName = groupByUniq(libraries, (lib) => lib.name);
  }

  appliesTo(op: SearchFilterValueNode): boolean {
    return (
      op.fieldSpec.key === 'library_name' &&
      (op.fieldSpec.type === 'string' || op.fieldSpec.type === 'faceted_string')
    );
  }

  mutate(op: SearchFilterValueNode): SearchFilterValueNode {
    if (
      op.fieldSpec.type !== 'string' &&
      op.fieldSpec.type !== 'faceted_string'
    ) {
      return op;
    }
    const value = op.fieldSpec.value;

    const newOp: SearchFilterValueNode = {
      ...op,
      fieldSpec: {
        ...op.fieldSpec,
        key: 'libraryId',
      },
    };

    newOp.fieldSpec.value = seq.collect(value, (libraryName) => {
      const match = this.byName[libraryName];
      if (!match) return;
      return match.uuid;
    });

    return newOp;
  }
}
