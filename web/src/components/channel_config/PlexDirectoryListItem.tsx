import { ExpandLess, ExpandMore } from '@mui/icons-material';
import {
  Box,
  Button,
  Collapse,
  Divider,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
} from '@mui/material';
import { PlexServerSettings } from '@tunarr/types';
import {
  PlexLibraryCollections,
  PlexLibraryMovies,
  PlexLibrarySection,
  PlexLibraryShows,
  isPlexMedia,
} from '@tunarr/types/plex';
import { take } from 'lodash-es';
import { MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { usePlexTyped2 } from '../../hooks/plex/usePlex.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForPlexServer,
  addPlexSelectedMedia,
} from '../../store/programmingSelector/actions.ts';
import { PlexListItem } from './PlexListItem.tsx';

export function PlexDirectoryListItem(props: {
  server: PlexServerSettings;
  item: PlexLibrarySection;
}) {
  const { server, item } = props;
  const [open, setOpen] = useState(false);
  const {
    isPending,
    first: children,
    second: collections,
  } = usePlexTyped2<
    PlexLibraryMovies | PlexLibraryShows,
    PlexLibraryCollections
  >([
    {
      serverName: props.server.name,
      path: `/library/sections/${item.key}/all`,
      enabled: open,
    },
    {
      serverName: props.server.name,
      path: `/library/sections/${item.key}/collections`,
      enabled: open,
    },
  ]);

  const listings = useStore((s) => s.knownMediaByServer[server.id]);
  const hierarchy = useStore(
    (s) => s.contentHierarchyByServer[server.id][item.uuid],
  );

  const observerTarget = useRef(null);
  const [limit, setLimit] = useState(Math.min(hierarchy.length, 20));

  useEffect(() => {
    const curr = observerTarget.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && limit < hierarchy.length) {
          setLimit((s) => s + 10);
        }
      },
      { threshold: 0.5 },
    );

    if (curr) {
      observer.observe(curr);
    }

    return () => {
      if (curr) {
        observer.unobserve(curr);
      }
    };
  }, [observerTarget, limit, hierarchy, setLimit]);

  useEffect(() => {
    if (children && children.Metadata) {
      addKnownMediaForPlexServer(server.id, children.Metadata, item.uuid);
    }

    if (collections && collections.Metadata) {
      addKnownMediaForPlexServer(server.id, collections.Metadata, item.uuid);
    }
  }, [item.uuid, item.key, server.id, children, collections]);

  const handleClick = () => {
    setLimit(Math.min(hierarchy.length, 20));
    setOpen(!open);
  };

  const addItems = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      addPlexSelectedMedia(server, [item]);
    },
    [item, server],
  );

  const renderCollectionRow = (id: string) => {
    const media = listings[id];

    if (isPlexMedia(media)) {
      return (
        <PlexListItem key={media.guid} item={media} length={hierarchy.length} />
      );
    }
  };

  return (
    <>
      <ListItem component="div" disablePadding>
        <ListItemButton selected={open} onClick={handleClick}>
          <ListItemIcon>{open ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
          <ListItemText primary={item.title} />
          <Button onClick={(e) => addItems(e)}>Add All</Button>
        </ListItemButton>
      </ListItem>
      <Collapse in={open && !isPending} timeout="auto" unmountOnExit>
        {isPending ? (
          <Skeleton>
            <Box sx={{ width: '100%', height: 400, pl: 4 }} />
          </Skeleton>
        ) : (
          <Box sx={{ width: '100%', height: 400, pl: 4, overflowY: 'scroll' }}>
            {take(hierarchy, limit).map(renderCollectionRow)}
            <div style={{ height: 40 }} ref={observerTarget}></div>
          </Box>
        )}
      </Collapse>
      <Divider variant="fullWidth" />
    </>
  );
}
