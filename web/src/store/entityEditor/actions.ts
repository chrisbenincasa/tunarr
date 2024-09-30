import { forAddedMediaType, typedProperty, unwrapNil } from '@/helpers/util';
import { AddedMedia } from '@/types';
import { forProgramType } from '@tunarr/shared/util';
import { ChannelProgram } from '@tunarr/types';
import {
  chain,
  extend,
  first,
  identity,
  isNil,
  last,
  map,
  sumBy,
} from 'lodash-es';
import { P, match } from 'ts-pattern';
import useStore, { State } from '..';
import {
  addIndexesAndCalculateOffsets,
  jellyfinItemToContentProgram,
  plexMediaToContentProgram,
} from '../channelEditor/actions';
import {
  ChannelEditorState,
  CurrentEntityEditor,
  CustomShowEditor,
  FillerListEditor,
} from '../channelEditor/store';
import { emptyChannelEditor } from './util';

export const getEditorOfType = (
  s: State,
  editor: CurrentEntityEditor | null = s.currentEditor,
): ChannelEditorState | CustomShowEditor | FillerListEditor | null => {
  return match(editor)
    .with({ type: 'channel', id: P.select() }, (id) =>
      id ? s.channels[id] : emptyChannelEditor(),
    )
    .with({ type: 'custom_show' }, () => s.customShowEditor)
    .with({ type: 'filler_list' }, () => s.fillerListEditor)
    .otherwise(() => null);
};

export const startProgramAddOperation = () =>
  useStore.setState((s) => {
    const editor = getEditorOfType(s);

    if (editor) {
      editor.addProgramsInProgress = true;
    }
  });

export const stopProgramAddOperation = (editor: CurrentEntityEditor) =>
  useStore.setState((s) => {
    const requestedEditor = getEditorOfType(s, editor);
    if (requestedEditor) {
      requestedEditor.addProgramsInProgress = false;
    }
  });

export const addSelectedMediaToEntityEditor = (
  requestedEditor: CurrentEntityEditor,
  programs: AddedMedia[],
) =>
  useStore.setState((s) => {
    const editor =
      requestedEditor.type === 'channel'
        ? s.channels[requestedEditor.id ?? '']
        : null;
    if (editor && editor.currentEntity) {
      editor.dirty.programs = true;
      const addedDuration = sumBy(
        programs,
        forAddedMediaType({
          plex: ({ media }) => media.duration,
          jellyfin: ({ media }) => (media.RunTimeTicks ?? 0) / 10_000,
          'custom-show': ({ program }) => program.duration,
        }),
      );

      // Convert any external program types to our internal representation
      const allNewPrograms = map(
        programs,
        forAddedMediaType<ChannelProgram>({
          plex: ({ media }) => plexMediaToContentProgram(media),
          jellyfin: ({ media }) => jellyfinItemToContentProgram(media),
          'custom-show': ({ program }) => program,
        }),
      );

      console.log({ ...editor });

      if (editor.type === 'channel') {
        const oldDuration = editor.currentEntity.duration;
        const newDuration = oldDuration + addedDuration;

        // Set the new channel duration based on the new program durations
        // const now = dayjs()
        editor.currentEntity.duration = newDuration;

        // Add offset times to all incoming programs
        const lastItem = last(editor.programList);
        const firstOffset = lastItem
          ? lastItem.startTimeOffset + lastItem.duration
          : 0;
        const programsWithOffset = addIndexesAndCalculateOffsets(
          allNewPrograms,
          firstOffset,
          editor.programList.length,
        );

        // Add new programs to the end of the existing list
        editor.programList.push(...programsWithOffset);

        // Add new lookups for these programs for when we materialize them in the selector
        // Extract the underlying content program from any custom programs
        const contentProgramsById = chain(allNewPrograms)
          .map(
            forProgramType({
              content: identity,
              custom: ({ program }) => program,
            }),
          )
          .compact()
          .groupBy(typedProperty('id'))
          .omitBy(isNil)
          .mapValues(unwrapNil(first))
          .value();
        extend(s.programLookup, contentProgramsById);
      }
    }
  });
