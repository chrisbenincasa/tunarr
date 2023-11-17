import { ExpandLess, ExpandMore } from '@mui/icons-material';
import {
  Box,
  Button,
  Collapse,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Skeleton,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { PlexServerSettings } from 'dizquetv-types';
import { PlexLibraryMovies, PlexLibrarySection } from 'dizquetv-types/plex';
import { isEmpty, isUndefined } from 'lodash-es';
import { useEffect, useState } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { usePlexServerSettings } from '../../hooks/settingsHooks.ts';
import { usePlex } from '../../hooks/usePlex.ts';

function PlexDirectoryListItem(props: {
  server: PlexServerSettings;
  item: PlexLibrarySection;
  onItemAdd: (item: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const { isPending, data } = useQuery({
    queryKey: [props.server.name, 'plex', 'sections', 'all', props.item.key],
    queryFn: async () => {
      const path = `/library/sections/${props.item.key}/all`;
      const res = await fetch(
        new URL(
          `http://localhost:8000/api/plex?name=${props.server.name}&path=${path}`,
        ),
      );
      return res.json() as Promise<PlexLibraryMovies>;
    },
    enabled: open,
  });

  const handleClick = () => {
    setOpen(!open);
  };

  const renderCollectionRow = (props: ListChildComponentProps) => {
    const { index, style } = props;
    const metadata = data!.Metadata[index];
    return (
      <ListItem style={style} key={index} component="div" disablePadding>
        <ListItemText primary={metadata.title} />
        <Button>Add</Button>
      </ListItem>
    );
  };

  return (
    <>
      <ListItem component="div" disablePadding>
        <ListItemButton selected={open} onClick={handleClick}>
          <ListItemText primary={props.item.title} />
          {open ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
      </ListItem>
      <Collapse in={open} timeout="auto" unmountOnExit>
        {isPending ? (
          <Skeleton>
            <Box sx={{ width: '100%', height: 400, pl: 4 }} />
          </Skeleton>
        ) : (
          <Box sx={{ width: '100%', height: 400, pl: 4 }}>
            <FixedSizeList
              height={400}
              itemCount={data?.Metadata?.length || 0}
              itemSize={46}
              width="100%"
              overscanCount={5}
            >
              {renderCollectionRow}
            </FixedSizeList>
          </Box>
        )}
      </Collapse>
    </>
  );
}

export default function ProgrammingSelector() {
  const { data: plexServers } = usePlexServerSettings();

  const [selectedServer, setSelectedServer] = useState<
    PlexServerSettings | undefined
  >(undefined);

  useEffect(() => {
    const server =
      !isUndefined(plexServers) && !isEmpty(plexServers)
        ? plexServers[0]
        : undefined;

    setSelectedServer(server);
  }, [plexServers]);

  const { data: plexResponse } = usePlex(
    selectedServer?.name ?? '',
    '/library/sections',
    !isUndefined(selectedServer),
  );

  return (
    <>
      <DialogTitle>Add Programming</DialogTitle>
      <DialogContent>
        <List component="nav" sx={{ width: '100%' }}>
          {plexResponse?.Directory?.map((dir) => (
            <PlexDirectoryListItem
              server={selectedServer!}
              key={dir.uuid}
              item={dir}
              onItemAdd={() => {}}
            />
          ))}
        </List>
      </DialogContent>
    </>
  );
}
