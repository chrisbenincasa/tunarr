import {
  CheckCircle,
  ExpandLess,
  ExpandMore,
  RadioButtonUnchecked,
} from '@mui/icons-material';
import {
  Collapse,
  IconButton,
  ImageListItem,
  ImageListItemBar,
  List,
  ListItemButton,
  ListItemIcon,
  Skeleton,
} from '@mui/material';
import {
  PlexChildMediaApiType,
  PlexMedia,
  isPlexCollection,
  isTerminalItem,
} from '@tunarr/types/plex';
import { filter } from 'lodash-es';
import React, { MouseEvent, useCallback, useEffect, useState } from 'react';
import { prettyItemDuration } from '../../helpers/util.ts';
import { usePlexTyped } from '../../hooks/plexHooks.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForServer,
  addPlexSelectedMedia,
  removePlexSelectedMedia,
} from '../../store/programmingSelector/actions.ts';
import { PlexSelectedMedia } from '../../store/programmingSelector/store.ts';

export interface PlexGridItemProps<T extends PlexMedia> {
  item: T;
  style?: React.CSSProperties;
  index?: number;
  length?: number;
  parent?: string;
}

export function PlexGridItem<T extends PlexMedia>(props: PlexGridItemProps<T>) {
  const server = useStore((s) => s.currentServer!); // We have to have a server at this point
  const darkMode = useStore((state) => state.theme.darkMode);
  const [open, setOpen] = useState(false);
  const { item } = props;
  const hasChildren = !isTerminalItem(item);
  const childPath = isPlexCollection(item) ? 'collections' : 'metadata';
  const { isPending, data: children } = usePlexTyped<PlexChildMediaApiType<T>>(
    server.name,
    `/library/${childPath}/${props.item.ratingKey}/children`,
    hasChildren && open,
  );
  const selectedServer = useStore((s) => s.currentServer);
  const selectedMedia = useStore((s) =>
    filter(s.selectedMedia, (p): p is PlexSelectedMedia => p.type === 'plex'),
  );
  const selectedMediaIds = selectedMedia.map((item) => item.guid);

  const handleClick = () => {
    setOpen(!open);
  };

  useEffect(() => {
    if (children) {
      addKnownMediaForServer(server.name, children.Metadata, item.guid);
    }
  }, [item.guid, server.name, children]);

  const handleItem = useCallback(
    (e: MouseEvent<HTMLLIElement | HTMLButtonElement>) => {
      e.stopPropagation();

      if (selectedMediaIds.includes(item.guid)) {
        removePlexSelectedMedia(selectedServer!.name, [item.guid]);
      } else {
        addPlexSelectedMedia(selectedServer!.name, [item]);
      }
    },
    [item, selectedServer, selectedMediaIds],
  );

  const renderChildren = () => {
    return isPending ? (
      <Skeleton />
    ) : (
      <List
        sx={{ pl: 4, display: 'flex', flexWrap: 'wrap', columnGap: '10px' }}
      >
        {children?.Metadata.map((child, idx, arr) => (
          <PlexGridItem
            key={child.guid}
            item={child}
            index={idx}
            length={arr.length}
          />
        ))}
      </List>
    );
  };

  return (
    <React.Fragment key={item.guid}>
      {hasChildren ? (
        <ListItemButton
          onClick={handleClick}
          dense
          sx={{
            display: 'block',
            width: '100%',
          }}
        >
          {hasChildren && (
            <ListItemIcon>
              {open ? <ExpandLess /> : <ExpandMore />}
            </ListItemIcon>
          )}
          <img
            src={`${server.uri}${item.thumb}?X-Plex-Token=${server.accessToken}`}
            width={100}
          />
        </ListItemButton>
      ) : (
        <ImageListItem
          key={item.guid}
          sx={{
            width: 160,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => handleItem(e)}
        >
          <img
            src={`${server.uri}${item.thumb}?X-Plex-Token=${server.accessToken}`}
            alt={item.title}
            loading="lazy"
          />
          <ImageListItemBar
            title={item.title}
            subtitle={<span>{prettyItemDuration(item.duration)}</span>}
            position="below"
            actionIcon={
              <IconButton
                sx={{ color: 'black' }}
                aria-label={`star ${item.title}`}
                onClick={(e) => handleItem(e)}
              >
                {selectedMediaIds.includes(item.guid) ? (
                  <CheckCircle sx={{ color: darkMode ? '#fff' : '#000' }} />
                ) : (
                  <RadioButtonUnchecked
                    sx={{ color: darkMode ? '#fff' : '#000' }}
                  />
                )}
              </IconButton>
            }
            actionPosition="right"
          />
        </ImageListItem>
      )}
      <Collapse in={open} timeout="auto" unmountOnExit>
        {renderChildren()}
      </Collapse>
    </React.Fragment>
  );
}
