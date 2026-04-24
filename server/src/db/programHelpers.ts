import type { ContentProgram, CustomProgram } from '@tunarr/types';
import { isContentProgram, isCustomProgram } from '@tunarr/types';
import { reduce } from 'lodash-es';

// Takes a listing of programs and makes a mapping of a unique identifier,
// which may differ when a program is persisted or not, to the original
// index in the list. This is useful for when the pending list may lose
// its original ordering during processing, bur requires ordering later
// on in processing
export function createPendingProgramIndexMap(
  programs: (ContentProgram | CustomProgram)[],
) {
  let idx = 0;
  return reduce(
    programs,
    (acc, p) => {
      if (isContentProgram(p) || isCustomProgram(p)) {
        acc[p.id] = idx++;
      }
      return acc;
    },
    {} as Record<string, number>,
  );
}
