import { createExternalId } from '@tunarr/shared';
import type { ChannelProgram, ContentProgram } from '@tunarr/types';
import { match, P } from 'ts-pattern';

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
  return match(program)
    .with(
      {
        type: 'content',
        subtype: P.select(P.union('movie', 'music_video', 'other_video')),
      },
      (typ) => typ,
    )
    .with({ type: 'content' }, (program) => {
      const grandparentId =
        program.grandparent?.id ?? getGrandparentExternalId(program);
      return `${program.subtype === 'episode' ? 'show' : 'artist'}.${grandparentId}`;
    })
    .with({ type: 'custom' }, (program) => `custom.${program.customShowId}`)
    .with({ type: 'redirect' }, (program) => `redirect.${program.channel}`)
    .with({ type: 'flex' }, () => 'flex')
    .with({ type: 'filler' }, (program) => `filler.${program.fillerListId}`)
    .exhaustive();
}
