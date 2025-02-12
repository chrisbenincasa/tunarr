import { isNonEmptyString } from '@/helpers/util.ts';
import type { UIChannelProgram } from '@/types/index.ts';
import { createExternalId } from '@tunarr/shared';
import { seq } from '@tunarr/shared/util';
import {
  isContentProgram,
  isCustomProgram,
  isFlexProgram,
  isRedirectProgram,
  tag,
} from '@tunarr/types';
import { forEach, reject, some } from 'lodash-es';
import { useCallback } from 'react';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';

export const useRemoveDuplicates = () => {
  const programs = useStore(materializedProgramListSelector);
  return useCallback(() => {
    if (programs.length > 0) {
      const newPrograms = removeDuplicatePrograms(programs);
      setCurrentLineup(newPrograms, true);
    }
  }, [programs]);
};

export const removeDuplicatePrograms = (programs: UIChannelProgram[]) => {
  const seenDbIds = new Set<string>();
  const seenIds = new Set<string>();
  const seenRedirects = new Set<string>();
  const seenCustom = new Set<string>();

  return reject(programs, (p) => {
    // Removes all flex
    if (isFlexProgram(p)) {
      return true;
    }

    if (isRedirectProgram(p)) {
      const seen = seenRedirects.has(p.channel);
      if (!seen) {
        seenRedirects.add(p.channel);
      }
      return seen;
    }

    if (isCustomProgram(p)) {
      const key = `${p.customShowId}_${p.id}`;
      const seen = seenCustom.has(key);
      if (!seen) {
        seenCustom.add(key);
      }
      return seen;
    }

    if (!isContentProgram(p)) {
      return true;
    }

    if (p.persisted && isNonEmptyString(p.id)) {
      if (seenDbIds.has(p.id)) {
        return true;
      }
      seenDbIds.add(p.id);
      return false;
    }

    const externalIds = seq.collect(p.externalIds, (id) => {
      if (id.type === 'multi') {
        return createExternalId(id.source, tag(id.sourceId), id.id);
      }
      return;
    });

    const seenAny = some(externalIds, (id) => seenIds.has(id));
    if (!seenAny) {
      forEach(externalIds, (id) => seenIds.add(id));
    }

    return seenAny;
  });
};
