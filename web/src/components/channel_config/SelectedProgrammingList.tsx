import { SelectedMedia } from '@/store/programmingSelector/store.ts';
import {
  KeyboardArrowLeft,
  KeyboardArrowRight,
  Close as RemoveIcon,
} from '@mui/icons-material';
import {
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
import {
  isPlexDirectory,
  isPlexMovie,
  isPlexPlaylist,
  isPlexSeason,
  isPlexShow,
} from '@tunarr/types/plex';
import { first, groupBy, isUndefined, mapValues, reduce } from 'lodash-es';
import pluralize from 'pluralize';
import { ReactNode, useState } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { useWindowSize } from 'usehooks-ts';
import { forSelectedMediaType, toggle, unwrapNil } from '../../helpers/util.ts';
import { useCustomShows } from '../../hooks/useCustomShows.ts';
import useStore from '../../store/index.ts';
import { removeSelectedMedia } from '../../store/programmingSelector/actions.ts';
import { AddedMedia } from '../../types/index.ts';
import AddSelectedMediaButton from './AddSelectedMediaButton.tsx';
import SelectedProgrammingActions from './SelectedProgrammingActions.tsx';

type Props = {
  onAddSelectedMedia: (media: AddedMedia[]) => void;
  onAddMediaSuccess: () => void;
  selectAllEnabled?: boolean;
};

export default function SelectedProgrammingList({
  onAddSelectedMedia,
  onAddMediaSuccess,
  selectAllEnabled = true,
}: Props) {
  const { data: customShows } = useCustomShows();
  const knownMedia = useStore((s) => s.knownMediaByServer);
  const selectedMedia = useStore((s) => s.selectedMedia);
  const [open, setOpen] = useState(false);
  const windowSize = useWindowSize();

  const toggleDrawer = (open?: boolean) => {
    setOpen(isUndefined(open) ? toggle : open);
  };

  const totalCount = reduce(
    selectedMedia,
    (acc, media) => acc + (media.childCount ?? 1),
    0,
  );

  const customShowById = mapValues(
    mapValues(groupBy(customShows, 'id'), first),
    unwrapNil,
  );

  const renderSelectedMediaType = forSelectedMediaType<
    JSX.Element,
    [ListChildComponentProps]
  >({
    plex: (selected, { style }) => {
      const media = knownMedia[selected.server][selected.guid];

      let title: string = media.title;
      let secondary: ReactNode = null;
      if (isPlexDirectory(media)) {
        // TODO: Show the size
        title = `Library - ${media.title}`;
      } else if (isPlexShow(media)) {
        secondary = `${media.childCount} ${pluralize(
          'season',
          media.childCount,
        )}, ${media.leafCount} total ${pluralize('episode', media.leafCount)}`;
      } else if (isPlexSeason(media)) {
        secondary = `${media.parentTitle} - ${media.title} (${
          media.leafCount
        } ${pluralize('episode', media.leafCount)})`;
      } else if (media.type === 'collection') {
        secondary = `${media.title} (${media.childCount} ${pluralize(
          'item',
          parseInt(media.childCount),
        )})`;
      } else if (isPlexMovie(media)) {
        secondary = `Movie${media.year ? ', ' + media.year : ''}`;
      } else if (isPlexPlaylist(media) && !isUndefined(media.leafCount)) {
        secondary = `Playlist with ${media.leafCount} ${pluralize(
          'tracks',
          media.leafCount,
        )}`;
      }

      return (
        <ListItem
          divider
          sx={{ px: 1 }}
          dense
          key={selected.guid}
          style={style}
        >
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
        return item.guid;
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

  const ActionsBar = () => (
    <SelectedProgrammingActions
      onAddSelectedMedia={onAddSelectedMedia}
      onAddMediaSuccess={onAddMediaSuccess}
      toggleOrSetSelectedProgramsDrawer={toggleDrawer}
      selectAllEnabled={selectAllEnabled}
    />
  );

  const ProgrammingList = () => (
    <>
      <ActionsBar />
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
            <IconButton disableRipple onClick={() => setOpen(toggle)}>
              {open ? <KeyboardArrowRight /> : <KeyboardArrowLeft />}
              {!open && <Chip label={selectedMedia.length} />}
            </IconButton>
          </Tooltip>
        </Paper>
      )}

      <ClickAwayListener onClickAway={() => setOpen(false)}>
        <Drawer
          anchor="right"
          open={open}
          variant="persistent"
          onClose={() => setOpen(false)}
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
            Selected {pluralize('Item', totalCount)} ({totalCount}):
          </Typography>
          <AddSelectedMediaButton
            onAdd={onAddSelectedMedia}
            onSuccess={onAddMediaSuccess}
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
