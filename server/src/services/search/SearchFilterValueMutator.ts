import type { SearchFilterValueNode } from '@tunarr/types/schemas';

export interface SearchFilterValueMutator {
  appliesTo(op: SearchFilterValueNode): boolean;
  mutate(op: SearchFilterValueNode): SearchFilterValueNode;
}
