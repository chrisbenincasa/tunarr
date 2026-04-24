import { Plural } from '@lingui/react/macro';
import { type ProgramOrFolder, getChildItemType } from '@tunarr/types';
import type { JSX } from 'react';
import { match, P } from 'ts-pattern';
import { prettyItemDuration } from '../../helpers/util.ts';

const ChildCountLabel = ({ count, type }: { count: number; type: string }) => {
  switch (type) {
    case 'season':
      return <Plural value={count} one="# season" other="# seasons" />;
    case 'episode':
      return <Plural value={count} one="# episode" other="# episodes" />;
    case 'album':
      return <Plural value={count} one="# album" other="# albums" />;
    case 'track':
      return <Plural value={count} one="# track" other="# tracks" />;
    default:
      return <Plural value={count} one="# item" other="# items" />;
  }
};

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
    .with({ childCount: P.select(P.number) }, (childCount, grouping) => {
      return (
        <span>
          <ChildCountLabel
            count={childCount}
            type={getChildItemType(grouping.type)}
          />
        </span>
      );
    })
    .otherwise((v) => {
      console.warn(v);
      return null;
    });
