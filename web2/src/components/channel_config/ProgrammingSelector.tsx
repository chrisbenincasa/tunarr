import { ExpandLess, ExpandMore } from '@mui/icons-material';
import {
  Box,
  Button,
  Collapse,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Skeleton,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { PlexServerSettings } from 'dizquetv-types';
import {
  PlexLibraryMovies,
  PlexLibraryShows,
  PlexMedia,
  PlexMovie,
  PlexSeasonView,
  PlexTvShow,
  isPlexMovie,
  isPlexShow,
} from 'dizquetv-types/plex';
import { isEmpty, isUndefined, take } from 'lodash-es';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePlex, usePlexTyped } from '../../hooks/plexHooks.ts';
import { usePlexServerSettings } from '../../hooks/settingsHooks.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForServer,
  setProgrammingDirectoryListings,
  setProgrammingListingServer,
  setProgrammingDirectory,
  addSelectedMedia,
  removeSelectedMedia,
} from '../../store/programmingSelector/actions.ts';
import {
  ProgrammingListing,
  ProgrammingDirectory,
  SelectedMedia,
} from '../../store/programmingSelector/store.ts';

interface PlexListItemProps<T extends PlexMedia> {
  item: T;
  listing: ProgrammingListing;
  style?: React.CSSProperties;
  index?: number;
}

function PlexShowListItem(props: PlexListItemProps<PlexTvShow>) {
  const server = useStore((s) => s.currentServer!); // We have to have a server at this point
  const [open, setOpen] = useState(false);
  const { item } = props;
  const { isPending, data } = usePlexTyped<PlexSeasonView>(
    server.name,
    `/library/metadata/${props.item.ratingKey}/children`,
    open,
  );

  const handleClick = () => {
    setOpen(!open);
  };

  useEffect(() => {}, []);

  return (
    <React.Fragment key={item.guid}>
      <ListItem dense>
        <ListItemIcon onClick={handleClick}>
          {open ? <ExpandLess /> : <ExpandMore />}
        </ListItemIcon>
        <ListItemText primary={item.title} />
        <Button>Add</Button>
      </ListItem>
      <Collapse in={open} timeout="auto" unmountOnExit>
        {isPending ? (
          <Skeleton />
        ) : (
          <Box
            sx={{ width: '100%', maxHeight: 400, pl: 4, overflowY: 'scroll' }}
          >
            <List>
              {data?.Metadata.map((season, idx, arr) => (
                <React.Fragment key={season.guid}>
                  <ListItem dense divider={idx < arr.length - 1}>
                    <ListItemIcon>
                      <ExpandMore />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${season.title} (${season.leafCount} episodes)`}
                    />
                    <Button>Add</Button>
                  </ListItem>
                  {/* <Divider variant="fullWidth" /> */}
                </React.Fragment>
              ))}
            </List>
          </Box>
        )}
      </Collapse>
      <Divider variant="fullWidth" />
    </React.Fragment>
  );
}

function PlexMovieListItem(props: PlexListItemProps<PlexMovie>) {
  const { item, index } = props;
  const selectedServer = useStore((s) => s.currentServer);

  const addItem = () => {
    addSelectedMedia(selectedServer!.name, [item]);
  };

  return (
    <ListItem key={index} component="div" disablePadding>
      <ListItemText primary={item.title} />
      <Button onClick={addItem}>Add</Button>
    </ListItem>
  );
}

function PlexDirectoryListItem(props: {
  server: PlexServerSettings;
  item: ProgrammingDirectory;
}) {
  const { server, item } = props;
  const [open, setOpen] = useState(false);
  const { isPending, data } = usePlexTyped<
    PlexLibraryMovies | PlexLibraryShows
  >(props.server.name, `/library/sections/${item.dir.key}/all`, open);
  const listings = useStore((s) => s.knownMediaByServer[server.name]);

  const observerTarget = useRef(null);
  const [limit, setLimit] = useState(Math.min(item.children.length, 20));

  useEffect(() => {
    const curr = observerTarget.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && limit < item.children.length) {
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
  }, [observerTarget, limit, item.children, setLimit]);

  useEffect(() => {
    if (data) {
      addKnownMediaForServer(server.name, data.Metadata);
      setProgrammingDirectoryListings(server.name, item.dir.key, data.Metadata);
    }
  }, [item.dir.title, item.dir.key, server.name, data]);

  const handleClick = () => {
    setLimit(Math.min(item.children.length, 20));
    setOpen(!open);
  };

  // const renderCollectionRow = (props: ListChildComponentProps) => {
  //   const { index, style } = props;

  //   const listing = item.children[index];
  //   const media = listings[listing.guid];

  //   if (isPlexShow(media)) {
  //     return (
  //       <PlexShowListItem
  //         item={media}
  //         listing={listing}
  //         style={style}
  //         index={index}
  //       />
  //     );
  //   } else if (isPlexMovie(media)) {
  //     return (
  //       <PlexMovieListItem
  //         item={media}
  //         listing={listing}
  //         style={style}
  //         index={index}
  //       />
  //     );
  //   } else {
  //     return null;
  //   }
  // };

  const renderCollectionRow2 = (listing: ProgrammingListing) => {
    const media = listings[listing.guid];
    if (isPlexShow(media)) {
      return (
        <PlexShowListItem
          key={media.guid}
          item={media}
          listing={listing}
          // style={style}
          // index={index}
        />
      );
    } else if (isPlexMovie(media)) {
      return (
        <PlexMovieListItem
          key={media.guid}
          item={media}
          listing={listing}
          // style={style}
          // index={index}
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
          <ListItemText primary={item.dir.title} />
          <Button>Add All</Button>
        </ListItemButton>
      </ListItem>
      <Collapse in={open} timeout="auto" unmountOnExit>
        {isPending ? (
          <Skeleton>
            <Box sx={{ width: '100%', height: 400, pl: 4 }} />
          </Skeleton>
        ) : (
          <Box sx={{ width: '100%', height: 400, pl: 4, overflowY: 'scroll' }}>
            {/* <FixedSizeList
              height={400}
              itemCount={item.children.length || 0}
              itemSize={46}
              width="100%"
              overscanCount={5}
            >
              {renderCollectionRow}
            </FixedSizeList> */}
            {take(item.children, limit).map(renderCollectionRow2)}
            <div style={{ height: 40 }} ref={observerTarget}></div>
          </Box>
        )}
      </Collapse>
      <Divider variant="fullWidth" />
    </>
  );
}

export default function ProgrammingSelector() {
  const { data: plexServers } = usePlexServerSettings();
  const selectedServer = useStore((s) => s.currentServer);
  const listingsByServer = useStore((s) => s.listingsByServer);
  const knownMedia = useStore((s) => s.knownMediaByServer);
  const selectedMedia = useStore((s) => s.selectedMedia);

  useEffect(() => {
    const server =
      !isUndefined(plexServers) && !isEmpty(plexServers)
        ? plexServers[0]
        : undefined;

    setProgrammingListingServer(server);
  }, [plexServers]);

  const { data: plexResponse } = usePlex(
    selectedServer?.name ?? '',
    '/library/sections',
    !isUndefined(selectedServer),
  );

  useEffect(() => {
    if (plexResponse) {
      setProgrammingDirectory(selectedServer!.name, [
        ...plexResponse.Directory,
      ]);
    }
  }, [selectedServer, plexResponse]);

  const removeSelectedItem = useCallback((selectedMedia: SelectedMedia) => {
    removeSelectedMedia(selectedMedia.server, [selectedMedia.guid]);
  }, []);

  const renderSelectedItems = () => {
    const items = selectedMedia.map((selected) => {
      const media = knownMedia[selected.server][selected.guid];
      return (
        <ListItem key={selected.guid}>
          <ListItemText primary={media.title} />
          <ListItemIcon>
            <IconButton onClick={() => removeSelectedItem(selected)}>
              <DeleteIcon color="error" />
            </IconButton>
          </ListItemIcon>
        </ListItem>
      );
    });
    return <List>{items}</List>;
  };

  return (
    <>
      <DialogTitle>Add Programming</DialogTitle>
      <DialogContent>
        <FormControl fullWidth size="small">
          {selectedServer && (
            <Select value={selectedServer?.name}>
              {plexServers?.map((server) => (
                <MenuItem key={server.name} value={server.name}>
                  {server.name}
                </MenuItem>
              ))}
            </Select>
          )}
        </FormControl>
        <List component="nav" sx={{ width: '100%' }}>
          {selectedServer &&
            (listingsByServer[selectedServer.name] ?? []).map((listing) => (
              <PlexDirectoryListItem
                server={selectedServer}
                key={listing.dir.uuid}
                item={listing}
              />
            ))}
        </List>
        <Typography>Selected Items</Typography>
        {selectedMedia.length > 0 && renderSelectedItems()}
      </DialogContent>
    </>
  );
}
