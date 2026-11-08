import type {
  SearchFilter,
  SearchFilterValueNode,
} from '@tunarr/types/schemas';
import type { SearchFilterValueMutator } from './SearchFilterValueMutator.ts';

const NegatedOps = new Set(['!=', 'not contains', 'not in']);

// Sources store descriptions in either `summary` or `plot`, so a summary
// filter checks both. Negated filters must exclude a match in either field.
export class SummarySearchMutator implements SearchFilterValueMutator {
  appliesTo(op: SearchFilterValueNode): boolean {
    return op.fieldSpec.key === 'summary' && op.fieldSpec.type === 'string';
  }

  mutate(op: SearchFilterValueNode): SearchFilter {
    return {
      type: 'op',
      op: NegatedOps.has(op.fieldSpec.op) ? 'and' : 'or',
      grouped: true,
      children: [op, { ...op, fieldSpec: { ...op.fieldSpec, key: 'plot' } }],
    };
  }
}
