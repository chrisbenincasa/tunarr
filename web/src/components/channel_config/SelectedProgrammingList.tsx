import JellyfinLogo from '@/assets/jellyfin.svg';
import { useMediaSources } from '@/hooks/settingsHooks.ts';
import { useKnownMedia } from '@/store/programmingSelector/selectors.ts';
import { type SelectedMedia } from '@/store/programmingSelector/store.ts';
import {
  KeyboardArrowLeft,
  KeyboardArrowRight,
  Close as RemoveIcon,
} from '@mui/icons-material';
import {
  Box,
  Chip,
  ClickAwayListener,
  Drawer,
  IconButton,
  ListItemText,
  Paper,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import { isPlexDirectory } from '@tunarr/types/plex';
import { find, first, groupBy, mapValues } from 'lodash-es';
import pluralize from 'pluralize';
import { type ReactNode, useEffect, useState } from 'react';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import { P, match } from 'ts-pattern';
import { useWindowSize } from 'usehooks-ts';
import { forSelectedMediaType, unwrapNil } from '../../helpers/util.ts';
import { useCustomShows } from '../../hooks/useCustomShows.ts';
import useStore from '../../store/index.ts';
import { removeSelectedMedia } from '../../store/programmingSelector/actions.ts';
import AddSelectedMediaButton from './AddSelectedMediaButton.tsx';

type Props = {
  selectAllEnabled?: boolean;
  isOpen: boolean;
  toggleOrSetSelectedProgramsDrawer: (open: boolean) => void;
};

export default function SelectedProgrammingList({
  isOpen,
  toggleOrSetSelectedProgramsDrawer,
}: Props) {
  const { data: mediaSources } = useMediaSources();
  const { data: customShows } = useCustomShows();
  const knownMedia = useKnownMedia();
  const selectedMedia = useStore((s) => s.selectedMedia);
  const [open, setOpen] = useState(isOpen);
  const windowSize = useWindowSize();

  useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);

  const customShowById = mapValues(
    mapValues(groupBy(customShows, 'id'), (x) => first(x)),
    unwrapNil,
  );

  const renderSelectedMediaType = forSelectedMediaType<
    JSX.Element,
    [ListChildComponentProps]
  >({
    plex: (selected, { style }) => {
      const media = knownMedia.getMediaOfType(
        selected.serverId,
        selected.id,
        'plex',
      )!;

      let title: string = media.title;
      let secondary: ReactNode = null;
      match(media)
        .with(
          P.when(isPlexDirectory),
          (dir) => (title = `Library - ${dir.title}`),
        )
        .with(
          { type: 'show' },
          (show) =>
            (secondary = `${show.childCount} ${pluralize(
              'season',
              show.childCount,
            )}, ${show.leafCount} total ${pluralize(
              'episode',
              show.leafCount,
            )}`),
        )
        .with(
          { type: 'season' },
          (season) =>
            (secondary = `${season.parentTitle} - ${season.title} (${
              season.leafCount
            } ${pluralize('episode', season.leafCount)})`),
        )
        .with(
          { type: 'collection' },
          (coll) =>
            (secondary = `${coll.title} (${coll.childCount} ${pluralize(
              'item',
              parseInt(coll.childCount),
            )})`),
        )
        .with(
          { type: 'movie' },
          (movie) =>
            (secondary = `Movie${movie.year ? ', ' + movie.year : ''}`),
        )
        .with(
          { type: 'playlist', leafCount: P.nonNullable },
          (playlist) =>
            (secondary = `Playlist with ${playlist.leafCount} ${pluralize(
              'tracks',
              playlist.leafCount,
            )}`),
        )
        .with(
          { type: 'episode' },
          (ep) => (secondary = `${ep.grandparentTitle}, ${ep.parentTitle}`),
        )
        .otherwise(() => {});

      return (
        <ListItem divider sx={{ px: 1 }} dense key={selected.id} style={style}>
          <ListItemText primary={title} secondary={secondary} />
          <ListItemIcon sx={{ minWidth: 40 }}>
            <IconButton onClick={() => removeSelectedMedia([selected])}>
              <RemoveIcon />
            </IconButton>
          </ListItemIcon>
        </ListItem>
      );
    },
    jellyfin: (selected, { style }) => {
      const media = knownMedia.getMediaOfType(
        selected.serverId,
        selected.id,
        'jellyfin',
      )!;

      let title: string = media.Name ?? '';
      let secondary: ReactNode = null;
      if (media.Type === 'CollectionFolder') {
        // TODO: Show the size
        title = `Media - ${media.Name}`;
      } else if (media.Type === 'Series') {
        secondary = `${media.ChildCount ?? 0} ${pluralize(
          'season',
          media.ChildCount ?? 0,
        )}, ${media.RecursiveItemCount ?? 0} total ${pluralize(
          'episode',
          media.RecursiveItemCount ?? 0,
        )}`;
      } else if (media.Type === 'Season') {
        secondary = `${media.SeriesName} - ${media.Name} (${
          media.ChildCount ?? 0
        } ${pluralize('episode', media.ChildCount ?? 0)})`;
        // } else if (media.Type === '') {
        //   secondary = `${media.title} (${media.childCount} ${pluralize(
        //     'item',
        //     parseInt(media.childCount),
        //   )})`;
        // }
      } else if (media.Type === 'Movie') {
        secondary = `Movie${
          media.ProductionYear ? ', ' + media.ProductionYear : ''
        }`;
      }
      // else if (isPlexPlaylist(media) && !isUndefined(media.leafCount)) {
      //   secondary = `Playlist with ${media.leafCount} ${pluralize(
      //     'tracks',
      //     media.leafCount,
      //   )}`;
      // }

      return (
        <ListItem divider sx={{ px: 1 }} dense key={media.Id} style={style}>
          <Tooltip
            placement="left"
            title={
              find(mediaSources, { id: selected.serverId })?.name ??
              'Jellyfin Server'
            }
          >
            <Box component="img" src={JellyfinLogo} width={30} sx={{ pr: 1 }} />
          </Tooltip>
          <ListItemText primary={title} secondary={secondary} />
          <ListItemIcon sx={{ minWidth: 40 }}>
            <IconButton onClick={() => removeSelectedMedia([selected])}>
              <RemoveIcon />
            </IconButton>
          </ListItemIcon>
        </ListItem>
      );
    },
    'custom-show': (selected, { index, style }) => {
      const customShow = customShowById[selected.customShowId];
      return (
        customShow && (
          <ListItem
            divider={index !== 0}
            sx={{ px: 1 }}
            dense
            key={`custom_${selected.customShowId}_${index}`}
            style={style}
          >
            <ListItemText
              primary={`${customShow.name}`}
              secondary={`${customShow.contentCount} ${pluralize(
                'item',
                customShow.contentCount,
              )}`}
            />
            <ListItemIcon sx={{ minWidth: 40 }}>
              <IconButton onClick={() => removeSelectedMedia([selected])}>
                <RemoveIcon />
              </IconButton>
            </ListItemIcon>
          </ListItem>
        )
      );
    },
  });

  const getItemKey = (index: number, data: SelectedMedia[]) => {
    const item = data[index];
    switch (item.type) {
      case 'plex':
        return `plex.${item.serverId}.${item.id}`;
      case 'jellyfin':
        return `jellyfin.${item.serverId}.${item.id}`;
      case 'custom-show':
        return `custom_${item.customShowId}_${index}`;
    }
  };

  const SelectedItemRow = (props: ListChildComponentProps) => {
    return renderSelectedMediaType(selectedMedia[props.index], props);
  };

  const renderSelectedItems = () => {
    return (
      <FixedSizeList
        itemCount={selectedMedia.length}
        itemKey={getItemKey}
        itemData={selectedMedia}
        height={windowSize.height}
        width="100%"
        itemSize={70}
      >
        {SelectedItemRow}
      </FixedSizeList>
    );
  };

  const drawerWidth = 240;

  const ProgrammingList = () => (
    <>
      {selectedMedia.length > 0 && (
        <Paper
          sx={{
            position: 'fixed',
            top: 64,
            right: open ? drawerWidth : 0,
            mt: 1,
          }}
        >
          <Tooltip
            title={
              !open
                ? `View selected ${pluralize('item', selectedMedia.length)}`
                : 'Close'
            }
            placement="left"
          >
            <IconButton
              disableRipple
              onClick={() => toggleOrSetSelectedProgramsDrawer(!open)}
            >
              {open ? <KeyboardArrowRight /> : <KeyboardArrowLeft />}
              {!open && <Chip label={selectedMedia.length} />}
            </IconButton>
          </Tooltip>
        </Paper>
      )}

      <ClickAwayListener
        onClickAway={() => toggleOrSetSelectedProgramsDrawer(false)}
      >
        <Drawer
          anchor="right"
          open={open}
          variant="persistent"
          onClose={() => toggleOrSetSelectedProgramsDrawer(false)}
          PaperProps={{ elevation: 2 }}
          sx={{
            width: drawerWidth,
            px: 1,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              px: 1,
              py: 0,
            },
            WebkitTransitionDuration: '.15s',
            WebkitTransitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)',
            overflowX: 'hidden',
          }}
        >
          <Toolbar
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              px: [1],
            }}
          ></Toolbar>
          <Typography textAlign={'left'} sx={{ my: 2, ml: 1, fontWeight: 600 }}>
            Selected {pluralize('Item', selectedMedia.length)} (
            {selectedMedia.length}):
          </Typography>
          <AddSelectedMediaButton
            buttonText={`Add ${pluralize('Item', selectedMedia.length)}`}
            variant="contained"
            color={'primary'}
            sx={{
              borderRadius: '10px',
              width: '100%',
            }}
          />
          {selectedMedia.length > 0 && renderSelectedItems()}
        </Drawer>
      </ClickAwayListener>
    </>
  );

  return <ProgrammingList />;
}
