import { useKnownMedia } from '@/store/programmingSelector/selectors.ts';
import { flattenDeep, map } from 'lodash-es';
import { type MouseEventHandler, useCallback, useState } from 'react';
import { match, P } from 'ts-pattern';
import { getProgramDescendants } from '../../generated/sdk.gen.ts';
import { Imported } from '../../helpers/constants.ts';
import { sequentialPromises } from '../../helpers/util.ts';
import useStore from '../../store/index.ts';
import { clearSelectedMedia } from '../../store/programmingSelector/actions.ts';
import { type AddedMedia } from '../../types/index.ts';
import { useProgrammingSelectionContext } from '../useProgrammingSelectionContext.ts';

export const useAddSelectedItems = () => {
  const { onAddMediaSuccess, onAddSelectedMedia } =
    useProgrammingSelectionContext();
  const knownMedia = useKnownMedia();
  const selectedMedia = useStore((s) => s.selectedMedia);
  const [isLoading, setIsLoading] = useState(false);

  const addSelectedItems: MouseEventHandler = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsLoading(true);
      sequentialPromises(selectedMedia, (selectedMedia) =>
        match(selectedMedia)
          .returnType<Promise<AddedMedia[]>>()
          .with({ type: 'custom-show' }, (selected) => {
            return Promise.resolve(
              map(selected.programs, (p) => ({
                type: 'custom-show',
                customShowId: selected.customShowId,
                totalDuration: selected.totalDuration,
                program: p,
              })),
            );
          })
          .with({ type: P.select() }, async (typ, selected) => {
            const media = knownMedia.getMediaOfType(
              selected.mediaSource.id,
              selected.id,
              typ,
            );

            if (!media) {
              console.warn('Media not found in local map', selected);
              return [];
            }

            const { data } = await getProgramDescendants({
              path: {
                id: selected.id,
              },
              throwOnError: true,
            });

            return data.map((program) => ({
              media: program,
              type: Imported,
            }));
          })
          .exhaustive(),
      )
        .then(flattenDeep)
        .then(onAddSelectedMedia)
        .then(() => {
          clearSelectedMedia();
          setIsLoading(false);
          onAddMediaSuccess();
        })
        .catch(console.error);
    },
    [knownMedia, onAddMediaSuccess, onAddSelectedMedia, selectedMedia],
  );

  return { addSelectedItems, isLoading };
};
