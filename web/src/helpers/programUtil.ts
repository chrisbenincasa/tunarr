import { createExternalId } from '@tunarr/shared';
import type { ChannelProgram, ContentProgram } from '@tunarr/types';

function getGrandparentExternalId(program: ContentProgram) {
  const sourceType = program.externalSourceType;
  const grandparentId = program.grandparent?.externalIds.find(
    (eid) => eid.source === sourceType,
  );
  if (!grandparentId) {
    return 'unknown';
  }
  if (grandparentId.type === 'single') {
    return 'unknown;';
  }

  return createExternalId(
    grandparentId.source,
    grandparentId.sourceId,
    grandparentId.id,
  );
}

export function getProgramGroupingKey(program: ChannelProgram) {
  switch (program.type) {
    case 'content': {
      switch (program.subtype) {
        case 'movie':
          return 'movie';
        case 'episode':
        case 'track': {
          // This will go away soon, but we still have to handle non-persisted items for now.
          const grandparentId =
            program.grandparent?.id ?? getGrandparentExternalId(program);
          return `${program.subtype === 'episode' ? 'show' : 'artist'}.${grandparentId}`;
        }
      }
    }
    // eslint-disable-next-line no-fallthrough
    case 'custom': {
      return `custom.${program.customShowId}`;
    }
    case 'redirect':
      return `redirect.${program.channel}`;
    case 'flex':
      return 'flex';
  }
}
