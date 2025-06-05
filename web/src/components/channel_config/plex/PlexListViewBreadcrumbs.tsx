import { Album, Folder, Home, Mic, Tv } from '@mui/icons-material';
import { Breadcrumbs, Link } from '@mui/material';
import type { PlexMedia } from '@tunarr/types/plex';
import { isEmpty, map } from 'lodash-es';
import { match, P } from 'ts-pattern';

type Props = {
  parentContext: PlexMedia[];
  popParentContextToIndex: (idx: number) => void;
  clearParentContext: () => void;
};

export const PlexListViewBreadcrumbs = ({
  parentContext,
  popParentContextToIndex,
  clearParentContext,
}: Props) => {
  const contextLinks = map(parentContext, (item, idx) => {
    const isLast = idx === parentContext.length - 1;
    const icon = match(item.type)
      .with('show', () => <Tv sx={{ mr: 0.5 }} fontSize="inherit" />)
      .with('artist', () => <Mic sx={{ mr: 0.5 }} fontSize="inherit" />)
      .with('album', () => <Album sx={{ mr: 0.5 }} fontSize="inherit" />)
      .with(P.union('collection', 'playlist'), () => (
        <Folder sx={{ mr: 0.5 }} fontSize="inherit" />
      ))
      .otherwise(() => null);
    return (
      <Link
        underline={isLast ? 'none' : 'hover'}
        color={isLast ? 'text.primary' : 'inherit'}
        sx={{
          cursor: isLast ? undefined : 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
        key={item.guid}
        onClick={() => (isLast ? () => {} : popParentContextToIndex(idx))}
      >
        {icon}
        {item.title}
      </Link>
    );
  });
  return (
    <Breadcrumbs maxItems={4} sx={{ my: 1 }}>
      <Link
        underline="hover"
        sx={{
          cursor: isEmpty(parentContext) ? undefined : 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
        color={isEmpty(parentContext) ? 'text.primary' : 'inherit'}
        onClick={clearParentContext}
      >
        <Home sx={{ mr: 0.5 }} fontSize="inherit" />
        Root
      </Link>
      {contextLinks}
    </Breadcrumbs>
  );
};
