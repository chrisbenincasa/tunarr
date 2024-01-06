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
import { PlexServerSettings } from 'dizquetv-types';
import {
  PlexLibraryMovies,
  PlexLibrarySection,
  PlexLibraryShows,
  isPlexMovie,
  isPlexShow,
} from 'dizquetv-types/plex';
import { take } from 'lodash-es';
import { useCallback, useEffect, useRef, useState, MouseEvent } from 'react';
import { usePlexTyped } from '../../hooks/plexHooks.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForServer,
  addSelectedMedia,
} from '../../store/programmingSelector/actions.ts';
import { PlexMovieListItem } from './PlexMovieListItem.tsx';
import { PlexTvListItem } from './PlexShowListItem.tsx';

export function PlexDirectoryListItem(props: {
  server: PlexServerSettings;
  item: PlexLibrarySection;
}) {
  const { server, item } = props;
  const [open, setOpen] = useState(false);
  const { isPending, data } = usePlexTyped<
    PlexLibraryMovies | PlexLibraryShows
  >(props.server.name, `/library/sections/${item.key}/all`, open);
  const listings = useStore((s) => s.knownMediaByServer[server.name]);
  const hierarchy = useStore(
    (s) => s.contentHierarchyByServer[server.name][item.uuid],
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
    if (data) {
      addKnownMediaForServer(server.name, data.Metadata, item.uuid);
    }
  }, [item.uuid, item.key, server.name, data]);

  const handleClick = () => {
    setLimit(Math.min(hierarchy.length, 20));
    setOpen(!open);
  };

  const addItems = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      addSelectedMedia(server.name, [item]);
    },
    [item, server.name],
  );

  const renderCollectionRow2 = (id: string) => {
    const media = listings[id];

    if (isPlexShow(media)) {
      return (
        <PlexTvListItem
          key={media.guid}
          item={media}
          length={hierarchy.length}
        />
      );
    } else if (isPlexMovie(media)) {
      return (
        <PlexMovieListItem
          key={media.guid}
          item={media}
          length={hierarchy.length}
        />
      );
    } else {
      return null;
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
      <Collapse in={open} timeout="auto" unmountOnExit>
        {isPending ? (
          <Skeleton>
            <Box sx={{ width: '100%', height: 400, pl: 4 }} />
          </Skeleton>
        ) : (
          <Box sx={{ width: '100%', height: 400, pl: 4, overflowY: 'scroll' }}>
            {take(hierarchy, limit).map(renderCollectionRow2)}
            <div style={{ height: 40 }} ref={observerTarget}></div>
          </Box>
        )}
      </Collapse>
      <Divider variant="fullWidth" />
    </>
  );
}
