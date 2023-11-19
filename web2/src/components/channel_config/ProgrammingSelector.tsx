import { ExpandLess, ExpandMore } from '@mui/icons-material';
import {
  Box,
  Button,
  Collapse,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
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
import { isEmpty, isUndefined } from 'lodash-es';
import React, { useEffect, useState } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { usePlex, usePlexTyped } from '../../hooks/plexHooks.ts';
import { usePlexServerSettings } from '../../hooks/settingsHooks.ts';
import useStore, {
  ProgrammingDirectory,
  ProgrammingListing,
  addKnownMediaForServer,
  setProgrammingDirectory,
  setProgrammingDirectoryListings,
  setProgrammingListingServer,
} from '../../store/index.ts';

interface PlexListItemProps<T extends PlexMedia> {
  item: T;
  listing: ProgrammingListing;
  style?: React.CSSProperties;
  index?: number;
}

function PlexShowListItem(props: PlexListItemProps<PlexTvShow>) {
  const server = useStore((s) => s.currentServer!); // We have to have a server at this point
  const [open, setOpen] = useState(false);
  const { style, item, index } = props;
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
    <>
      <ListItem style={style} key={index} component="div" disablePadding>
        <ListItemIcon onClick={handleClick}>
          <ExpandMore />
        </ListItemIcon>
        <ListItemText primary={item.title} />
        <Button>Add</Button>
      </ListItem>
      <Collapse in={open} timeout="auto" unmountOnExit>
        {isPending ? (
          <Skeleton />
        ) : (
          <List>
            {data?.Metadata.map((season) => (
              <ListItem key={season.guid}>
                <ListItemText primary={season.title} />
              </ListItem>
            ))}
          </List>
        )}
      </Collapse>
    </>
  );
}

function PlexMovieListItem(props: PlexListItemProps<PlexMovie>) {
  const { style, item, index } = props;

  return (
    <ListItem style={style} key={index} component="div" disablePadding>
      <ListItemText primary={item.title} />
      <Button>Add</Button>
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

  useEffect(() => {
    if (data) {
      addKnownMediaForServer(server.name, data.Metadata);
      setProgrammingDirectoryListings(server.name, item.dir.key, data.Metadata);
    }
  }, [item.dir.key, server.name, data]);

  const handleClick = () => {
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
          item={media}
          listing={listing}
          // style={style}
          // index={index}
        />
      );
    } else if (isPlexMovie(media)) {
      return (
        <PlexMovieListItem
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
            {item.children.map(renderCollectionRow2)}
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
      </DialogContent>
    </>
  );
}
