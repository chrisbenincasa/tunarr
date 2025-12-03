import { createExternalId } from '@tunarr/shared';
import type { ProgramOrFolder } from '@tunarr/types';
import { tag, type ChannelProgram, type ContentProgram } from '@tunarr/types';
import type { SearchRequest } from '@tunarr/types/api';
import { match, P } from 'ts-pattern';
import { postApiProgramsSearch } from '../generated/sdk.gen.ts';
import type { Nullable } from '../types/util.ts';

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
    tag(grandparentId.sourceId),
    grandparentId.id,
  );
}

export function getProgramGroupingKey(program: ChannelProgram): string {
  return (
    match(program)
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
      // .with({type: 'content', persisted: false}, program => {
      //   const grandparentId = program.grandparent
      // })
      .with({ type: 'custom' }, (program) => `custom.${program.customShowId}`)
      .with({ type: 'redirect' }, (program) => `redirect.${program.channel}`)
      .with({ type: 'flex' }, () => 'flex')
      .with({ type: 'filler' }, (program) => `filler.${program.fillerListId}`)
      .exhaustive()
  );
}

export async function enumerateSyncedItems(
  mediaSourceId: string,
  libraryId: Nullable<string>,
  searchRequest: Nullable<SearchRequest>,
) {
  const results: ProgramOrFolder[] = [];
  const loop = async (page?: number): Promise<ProgramOrFolder[]> => {
    const result = await postApiProgramsSearch({
      body: {
        mediaSourceId,
        libraryId: libraryId ?? undefined,
        query: {
          query: searchRequest?.query,
          filter: searchRequest?.filter,
          restrictSearchTo: searchRequest?.restrictSearchTo,
        },
        limit: 50,
        page,
      },
      throwOnError: true,
    });

    if (result.data.results.length === 0) {
      return results;
    }

    results.push(...result.data.results);

    return loop(result.data.page + 1);
  };

  return loop();
}
