import { Album, Folder, Home, Mic, Tv } from '@mui/icons-material';
import { Breadcrumbs, Link } from '@mui/material';
import type { EmbyItem } from '@tunarr/types/emby';
import { isEmpty, map } from 'lodash-es';
import { match } from 'ts-pattern';
import type { ProgramHierarchyHookReturn } from '../../../hooks/channel_config/useProgramHierarchy.ts';

type Props = ProgramHierarchyHookReturn<EmbyItem>;

export const EmbyListViewBreadcrumbs = ({
  parentContext,
  popParentContextToIndex,
  clearParentContext,
}: Props) => {
  const contextLinks = map(parentContext, (item, idx) => {
    const isLast = idx === parentContext.length - 1;
    const icon = match(item.Type)
      .with('Series', () => <Tv sx={{ mr: 0.5 }} fontSize="inherit" />)
      .with('MusicArtist', () => <Mic sx={{ mr: 0.5 }} fontSize="inherit" />)
      .with('MusicAlbum', () => <Album sx={{ mr: 0.5 }} fontSize="inherit" />)
      .with('Folder', () => <Folder sx={{ mr: 0.5 }} fontSize="inherit" />)
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
        key={item.Id}
        onClick={() => (isLast ? () => {} : popParentContextToIndex(idx))}
      >
        {icon}
        {item.Name}
      </Link>
    );
  });
  return (
    <Breadcrumbs maxItems={4} sx={{ mt: 1 }}>
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
