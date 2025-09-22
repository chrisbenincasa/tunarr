import { useMediaSources } from '@/hooks/settingsHooks.ts';
import { useKnownMedia } from '@/store/programmingSelector/selectors.ts';
import type {
  ExternalSourceSelectedMedia,
  LocalSourceSelectedMedia,
} from '@/store/programmingSelector/store.ts';
import { type SelectedMedia } from '@/store/programmingSelector/store.ts';
import { KeyboardArrowRight, Close as RemoveIcon } from '@mui/icons-material';
import {
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
import { type MediaSourceSettings } from '@tunarr/types';
import { first, groupBy, mapValues } from 'lodash-es';
import pluralize from 'pluralize';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import { useWindowSize } from 'usehooks-ts';
import { Emby, Jellyfin, Local, Plex } from '../../helpers/constants.ts';
import { unwrapNil } from '../../helpers/util.ts';
import { useCustomShows } from '../../hooks/useCustomShows.ts';
import useStore from '../../store/index.ts';
import { type KnownMedia } from '../../store/programmingSelector/KnownMedia.ts';
import { removeSelectedMedia } from '../../store/programmingSelector/actions.ts';
import { NetworkIcon } from '../util/NetworkIcon.tsx';

type Props = {
  selectAllEnabled?: boolean;
  isOpen: boolean;
  toggleOrSetSelectedProgramsDrawer: (open: boolean) => void;
};

type SelectedProgramListItemProps<SelectedMediaType> = {
  selected: SelectedMediaType;
  knownMedia: KnownMedia;
  listChildProps: ListChildComponentProps;
  mediaSourcesById: Record<string, MediaSourceSettings>;
};

const ImportedProgramListItem = ({
  selected,
  knownMedia,
  listChildProps,
  mediaSourcesById,
}: SelectedProgramListItemProps<
  LocalSourceSelectedMedia | ExternalSourceSelectedMedia
>) => {
  const media = knownMedia.getMediaOfType(
    selected.mediaSource.id,
    selected.id,
    selected.mediaSource.type,
  );

  if (!media) {
    return;
  }

  let secondary: ReactNode = null;
  switch (media?.type) {
    case 'show':
      secondary = `${media.childCount ?? 0} ${pluralize(
        'season',
        media.childCount ?? 0,
      )}, ${media.grandchildCount ?? 0} total ${pluralize(
        'episode',
        media.grandchildCount ?? 0,
      )}`;
      break;
    case 'movie':
      secondary = `Movie${media.year ? ', ' + media.year : ''}`;
      break;
    default:
      break;
  }
  // if (media.Type === 'CollectionFolder') {
  //   // TODO: Show the size
  //   title = `Media - ${media.Name}`;
  // } else if (media.Type === 'Series') {
  //   secondary = `${media.ChildCount ?? 0} ${pluralize(
  //     'season',
  //     media.ChildCount ?? 0,
  //   )}, ${media.RecursiveItemCount ?? 0} total ${pluralize(
  //     'episode',
  //     media.RecursiveItemCount ?? 0,
  //   )}`;
  // } else if (media.Type === 'Season') {
  //   secondary = `${media.SeriesName} - ${media.Name} (${
  //     media.ChildCount ?? 0
  //   } ${pluralize('episode', media.ChildCount ?? 0)})`;
  // } else if (media.Type === 'Movie') {
  //   secondary = `Movie${
  //     media.ProductionYear ? ', ' + media.ProductionYear : ''
  //   }`;
  // }

  return (
    <ListItem
      {...listChildProps}
      divider
      sx={{ px: 1 }}
      dense
      key={selected.id}
    >
      <Tooltip
        placement="left"
        title={mediaSourcesById[selected.mediaSource.id]?.name ?? ''}
      >
        <NetworkIcon
          network={mediaSourcesById[selected.mediaSource.id].type}
          width={30}
          sx={{ pr: 1 }}
        />
      </Tooltip>
      <ListItemText primary={media?.title ?? ''} secondary={secondary} />
      <ListItemIcon sx={{ minWidth: 40 }}>
        <IconButton onClick={() => removeSelectedMedia([selected])}>
          <RemoveIcon />
        </IconButton>
      </ListItemIcon>
    </ListItem>
  );
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

  const mediaSourcesById = useMemo(() => {
    const mediaSourcesById: Record<string, MediaSourceSettings> = {};
    for (const source of mediaSources) {
      mediaSourcesById[source.id] = source;
    }
    return mediaSourcesById;
  }, [mediaSources]);

  const getItemKey = (index: number, data: SelectedMedia[]) => {
    const item = data[index];
    switch (item.type) {
      case Plex:
      case Jellyfin:
      case Emby:
      case Local:
        return `${item.type}.${item.mediaSource.id}.${item.id}`;
      case 'custom-show':
        return `custom_${item.customShowId}_${index}`;
    }
  };

  const SelectedItemRow = (props: ListChildComponentProps) => {
    const selected = selectedMedia[props.index];
    switch (selected.type) {
      case Plex:
      case Jellyfin:
      case Emby:
      case Local:
        return (
          <ImportedProgramListItem
            knownMedia={knownMedia}
            listChildProps={props}
            selected={selected}
            mediaSourcesById={mediaSourcesById}
          />
        );
      case 'custom-show': {
        const customShow = customShowById[selected.customShowId];
        return (
          customShow && (
            <ListItem
              divider={props.index !== 0}
              sx={{ px: 1 }}
              dense
              key={`custom_${selected.customShowId}_${props.index}`}
              style={props.style}
            >
              <ListItemText
                primary={`Custom Show - ${customShow.name}`}
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
      }
    }
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
      {selectedMedia.length > 0 && open && (
        <Paper
          sx={{
            position: 'fixed',
            top: 64,
            right: open ? drawerWidth : 0,
            mt: 1,
            zIndex: 10,
          }}
        >
          <Tooltip title={'Close'} placement="left">
            <IconButton
              disableRipple
              onClick={() => toggleOrSetSelectedProgramsDrawer(!open)}
            >
              <KeyboardArrowRight />
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
          {selectedMedia.length > 0 && renderSelectedItems()}
        </Drawer>
      </ClickAwayListener>
    </>
  );

  return <ProgrammingList />;
}
