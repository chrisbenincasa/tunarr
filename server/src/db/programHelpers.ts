import { isNonEmptyString } from '@/util/index.js';
import { createExternalId } from '@tunarr/shared';
import type { ContentProgram, CustomProgram } from '@tunarr/types';
import { isContentProgram, isCustomProgram, tag } from '@tunarr/types';
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
      if ((p.persisted || isCustomProgram(p)) && isNonEmptyString(p.id)) {
        acc[p.id] = idx++;
        // TODO handle other types of programs
      } else if (
        isContentProgram(p) &&
        isNonEmptyString(p.externalSourceId) &&
        isNonEmptyString(p.externalSourceType) &&
        isNonEmptyString(p.externalKey) &&
        p.externalSourceType !== 'local'
      ) {
        acc[
          createExternalId(
            p.externalSourceType,
            tag(p.externalSourceId),
            p.externalKey,
          )
        ] = idx++;
      }
      return acc;
    },
    {} as Record<string, number>,
  );
}
