import { type ProgramOrFolder, getChildItemType } from '@tunarr/types';
import pluralize from 'pluralize';
import type { JSX } from 'react';
import { match, P } from 'ts-pattern';
import { prettyItemDuration } from '../../helpers/util.ts';

export const ProgramSubtitle = (program: ProgramOrFolder) =>
  match(program)
    .returnType<JSX.Element | null>()
    .with(
      {
        type: P.union(
          'movie',
          'episode',
          'track',
          'music_video',
          'other_video',
        ),
      },
      (terminal) => <span>{prettyItemDuration(terminal.duration)}</span>,
    )
    .with({ childCount: P.nullish }, () => null)
    .with({ childCount: P.select() }, (childCount, grouping) => {
      return (
        <span>{`${childCount} ${pluralize(
          getChildItemType(grouping.type),
          childCount,
        )}`}</span>
      );
    })
    .otherwise((v) => {
      console.warn(v);
      return null;
    });
