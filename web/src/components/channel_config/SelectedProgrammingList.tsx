import { Close as RemoveIcon } from '@mui/icons-material';
import {
  Drawer,
  IconButton,
  ListItemText,
  SwipeableDrawer,
  Toolbar,
  Typography,
  styled,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import { grey } from '@mui/material/colors';
import { isPlexDirectory, isPlexSeason, isPlexShow } from '@tunarr/types/plex';
import { chain, first, groupBy, mapValues, reduce } from 'lodash-es';
import pluralize from 'pluralize';
import { useState } from 'react';
import { forSelectedMediaType, unwrapNil } from '../../helpers/util.ts';
import { useCustomShows } from '../../hooks/useCustomShows.ts';
import useStore from '../../store/index.ts';
import { removeSelectedMedia } from '../../store/programmingSelector/actions.ts';
import { AddedMedia } from '../../types/index.ts';
import SelectedProgrammingActions from './SelectedProgrammingActions.tsx';

type Props = {
  onAddSelectedMedia: (media: AddedMedia[]) => void;
  onAddMediaSuccess: () => void;
};

const StyledBox = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'light' ? '#fff' : grey[800],
}));

const Puller = styled('div')(({ theme }) => ({
  width: 30,
  height: 6,
  backgroundColor: theme.palette.mode === 'light' ? grey[300] : grey[900],
  borderRadius: 3,
  position: 'absolute',
  top: 8,
  left: 'calc(50% - 15px)',
}));

export default function SelectedProgrammingList({
  onAddSelectedMedia,
  onAddMediaSuccess,
}: Props) {
  const { data: customShows } = useCustomShows();
  const knownMedia = useStore((s) => s.knownMediaByServer);
  const selectedMedia = useStore((s) => s.selectedMedia);
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const [open, setOpen] = useState(false);

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
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

  const renderSelectedMediaType = forSelectedMediaType<JSX.Element, [number]>({
    plex: (selected) => {
      const media = knownMedia[selected.server][selected.guid];

      let title: string = media.title;
      if (isPlexDirectory(media)) {
        title = `Library - ${media.title}`;
      } else if (isPlexShow(media)) {
        title = `${media.title} (${media.childCount} ${pluralize(
          'season',
          media.childCount,
        )}, ${media.leafCount} total ${pluralize('episode', media.leafCount)})`;
      } else if (isPlexSeason(media)) {
        title = `${media.parentTitle} - ${media.title} (${
          media.leafCount
        } ${pluralize('episode', media.leafCount)})`;
      } else if (media.type === 'collection') {
        title = `${media.title} (${media.childCount} ${pluralize(
          'item',
          parseInt(media.childCount),
        )})`;
      }

      return (
        <ListItem dense key={selected.guid}>
          <ListItemText primary={title} />
          <ListItemIcon sx={{ minWidth: 40 }}>
            <IconButton onClick={() => removeSelectedMedia([selected])}>
              <RemoveIcon />
            </IconButton>
          </ListItemIcon>
        </ListItem>
      );
    },
    'custom-show': (selected, index: number) => {
      const customShow = customShowById[selected.customShowId];
      return (
        customShow && (
          <ListItem key={`custom_${selected.customShowId}_${index}`}>
            Custom Show {customShow.name}
          </ListItem>
        )
      );
    },
  });

  const renderSelectedItems = () => {
    const items = chain(selectedMedia)
      .map((item, index) => renderSelectedMediaType(item, index))
      .compact()
      .value();

    return (
      <List sx={{ display: 'flex', flexDirection: 'column-reverse' }}>
        {items}
      </List>
    );
  };

  const drawerWidth = 240;

  const ActionsBar = () => (
    <SelectedProgrammingActions
      onAddSelectedMedia={onAddSelectedMedia}
      onAddMediaSuccess={onAddMediaSuccess}
      onSelectionModalClose={toggleDrawer(!open)}
    />
  );

  const MobileProgrammingList = () => (
    <>
      <ActionsBar />
      <SwipeableDrawer
        anchor="right"
        open={selectedMedia.length > 0 && open}
        onClose={toggleDrawer(false)}
        onOpen={toggleDrawer(true)}
        disableSwipeToOpen={false}
        swipeAreaWidth={50}
        ModalProps={{
          keepMounted: true,
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
        <Typography textAlign={'left'} sx={{ mx: 2, mt: 2, fontWeight: 600 }}>
          Selected {pluralize('Item', totalCount)} ({totalCount}):
        </Typography>
        <StyledBox
          sx={{
            position: 'absolute',
            top: 0,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            visibility: 'visible',
            right: 0,
            left: 0,
          }}
        >
          <Puller />
          <Typography sx={{ p: 2, color: 'text.secondary' }}>
            {totalCount} Selected {pluralize('Item', totalCount)}
          </Typography>
        </StyledBox>
        {selectedMedia.length > 0 && renderSelectedItems()}
      </SwipeableDrawer>
    </>
  );

  const DesktopProgrammingList = () => (
    <>
      <ActionsBar />
      <Drawer
        anchor="right"
        open={true}
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            p: 0,
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
        <Typography textAlign={'left'} sx={{ mx: 2, mt: 2, fontWeight: 600 }}>
          Selected {pluralize('Item', totalCount)} ({totalCount}):
        </Typography>
        {selectedMedia.length > 0 && renderSelectedItems()}
      </Drawer>
    </>
  );

  return smallViewport ? <MobileProgrammingList /> : <DesktopProgrammingList />;
}
