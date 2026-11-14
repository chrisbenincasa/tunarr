import { Trans } from '@lingui/react/macro';
import { Album, Folder, Home, Mic, Tv } from '@mui/icons-material';
import { Breadcrumbs, Link } from '@mui/material';
import type { ProgramOrFolder } from '@tunarr/types';
import { isEmpty, map } from 'lodash-es';
import type { ProgramHierarchyHookReturn } from '../../hooks/channel_config/useProgramHierarchy.ts';

type Props = ProgramHierarchyHookReturn<ProgramOrFolder>;

function contextIcon(type: ProgramOrFolder['type']) {
  switch (type) {
    case 'show':
      return <Tv sx={{ mr: 0.5 }} fontSize="inherit" />;
    case 'artist':
      return <Mic sx={{ mr: 0.5 }} fontSize="inherit" />;
    case 'album':
      return <Album sx={{ mr: 0.5 }} fontSize="inherit" />;
    case 'folder':
      return <Folder sx={{ mr: 0.5 }} fontSize="inherit" />;
    case 'movie':
    case 'episode':
    case 'track':
    case 'other_video':
    case 'music_video':
    case 'season':
    case 'collection':
    case 'playlist':
      return null;
  }
}

export const LibraryListViewBreadcrumbs = ({
  parentContext,
  popParentContextToIndex,
  clearParentContext,
}: Props) => {
  const contextLinks = map(parentContext, (item, idx) => {
    const isLast = idx === parentContext.length - 1;
    const icon = contextIcon(item.type);
    return (
      <Link
        underline={isLast ? 'none' : 'hover'}
        color={isLast ? 'text.primary' : 'inherit'}
        sx={{
          cursor: isLast ? undefined : 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
        key={item.uuid}
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
        <Trans>Root</Trans>
      </Link>
      {contextLinks}
    </Breadcrumbs>
  );
};
