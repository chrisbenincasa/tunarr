import { seq } from '@tunarr/shared/util';
import type { SearchFilterValueNode } from '@tunarr/types/schemas';
import type { Dictionary } from 'ts-essentials';
import type { MediaSourceOrm } from '../../db/schema/MediaSource.ts';
import { groupByUniq } from '../../util/index.ts';
import type { SearchFilterValueMutator } from './SearchFilterValueMutator.ts';

export class MediaSourceNameSearchMutator implements SearchFilterValueMutator {
  private byName!: Dictionary<MediaSourceOrm>;

  constructor(mediaSources: MediaSourceOrm[]) {
    this.byName = groupByUniq(mediaSources, (ms) => ms.name);
  }

  appliesTo(op: SearchFilterValueNode): boolean {
    return (
      op.fieldSpec.key === 'media_source_name' &&
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
        key: 'mediaSourceId',
      },
    };

    newOp.fieldSpec.value = seq.collect(value, (mediaSourceName) => {
      const match = this.byName[mediaSourceName];
      if (!match) return;
      return match.uuid;
    });

    return newOp;
  }
}
