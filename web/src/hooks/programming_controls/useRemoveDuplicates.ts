import { createExternalId } from '@tunarr/shared';
import {
  ChannelProgram,
  MultiExternalId,
  isContentProgram,
  isCustomProgram,
  isFlexProgram,
  isRedirectProgram,
} from '@tunarr/types';
import { chain, forEach, reject, some } from 'lodash-es';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';

export const useRemoveDuplicates = () => {
  const programs = useStore(materializedProgramListSelector);
  return () => {
    if (programs.length > 0) {
      const newPrograms = removeDuplicatePrograms(programs);
      setCurrentLineup(newPrograms, true);
    }
  };
};

export const removeDuplicatePrograms = (programs: ChannelProgram[]) => {
  const seenIds = new Set<string>();
  const seenRedirects = new Set<string>();
  const seenCustom = new Set<string>();

  return reject(programs, (p) => {
    // Removes all flex
    if (isFlexProgram(p)) {
      return true;
    }

    if (isRedirectProgram(p) || isCustomProgram(p)) {
      const setToCheck = isRedirectProgram(p) ? seenRedirects : seenCustom;
      const idToCheck = isRedirectProgram(p) ? p.channel : p.customShowId;
      const seen = setToCheck.has(idToCheck);
      if (!seen) {
        setToCheck.add(idToCheck);
      }
      return seen;
    }

    if (!isContentProgram(p)) {
      return true;
    }

    const externalIds = chain(p.externalIds)
      .filter((id): id is MultiExternalId => id.type === 'multi')
      .map((id) => createExternalId(id.source, id.sourceId, id.id))
      .value();
    const seenAny = some(externalIds, (id) => seenIds.has(id));
    if (!seenAny) {
      forEach(externalIds, (id) => seenIds.add(id));
    }

    return seenAny;
  });
};
