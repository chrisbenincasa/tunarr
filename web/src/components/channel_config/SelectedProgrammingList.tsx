import { Delete } from '@mui/icons-material';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Box,
  Button,
  IconButton,
  ListItemText,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import { isPlexDirectory, isPlexSeason, isPlexShow } from '@tunarr/types/plex';
import { chain, first, groupBy, mapValues, reduce } from 'lodash-es';
import pluralize from 'pluralize';
import { useCallback } from 'react';
import { forSelectedMediaType, unwrapNil } from '../../helpers/util.ts';
import { useCustomShows } from '../../hooks/useCustomShows.ts';
import useStore from '../../store/index.ts';
import {
  clearSelectedMedia,
  removeSelectedMedia,
} from '../../store/programmingSelector/actions.ts';
import { AddedMedia } from '../../types/index.ts';
import AddSelectedMediaButton from './AddSelectedMediaButton.tsx';

type Props = {
  onAddSelectedMedia: (media: AddedMedia[]) => void;
  onAddMediaSuccess: () => void;
};

export default function SelectedProgrammingList({
  onAddSelectedMedia,
  onAddMediaSuccess,
}: Props) {
  const { data: customShows } = useCustomShows();
  const knownMedia = useStore((s) => s.knownMediaByServer);
  const selectedMedia = useStore((s) => s.selectedMedia);
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const totalCount = reduce(
    selectedMedia,
    (acc, media) => acc + (media.childCount ?? 1),
    0,
  );

  const customShowById = mapValues(
    mapValues(groupBy(customShows, 'id'), first),
    unwrapNil,
  );

  const removeAllItems = useCallback(() => {
    clearSelectedMedia();
  }, []);

  // const formattedTitle = useMemo(
  //   () =>
  //     forProgramType({
  //       content: (p) => p.title,
  //     }),
  //   [],
  // );

  // const formattedEpisodeTitle = useMemo(
  //   () =>
  //     forProgramType({
  //       custom: (p) => p.program?.episodeTitle ?? '',
  //     }),
  //   [],
  // );

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
        <ListItem key={selected.guid} dense>
          <ListItemText primary={title} />
          <ListItemIcon>
            <IconButton onClick={() => removeSelectedMedia([selected])}>
              <DeleteIcon color="error" />
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

    return <List>{items}</List>;
  };

  return (
    <>
      <List>{selectedMedia.length > 0 && renderSelectedItems()}</List>
      {selectedMedia.length > 0 && (
        <Box
          sx={{
            borderRadius: '10px',
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
            position: 'fixed',
            bottom: '1em',
            width: '100%',
            maxWidth: '500px',
            margin: '1em auto 46px',
            left: 0,
            right: 0,
            display: 'flex',
            padding: '5px 0',
          }}
        >
          <Typography
            sx={{
              display: 'flex',
              alignItems: 'center',
              marginLeft: '1em',
              flexGrow: '1',
            }}
          >
            {totalCount} Selected {pluralize('Item', totalCount)}{' '}
          </Typography>

          <Tooltip title="Unselect all programs">
            <Button
              startIcon={smallViewport ? null : <Delete />}
              sx={{
                color: theme.palette.primary.contrastText,
                border: `1px solid ${theme.palette.primary.contrastText}`,
                borderRadius: '10px',
                marginRight: '8px',
              }}
              onClick={() => removeAllItems()}
            >
              Unselect All
            </Button>
          </Tooltip>

          <AddSelectedMediaButton
            onAdd={onAddSelectedMedia}
            onSuccess={onAddMediaSuccess}
            sx={{
              color: theme.palette.primary.contrastText,
              border: `1px solid ${theme.palette.primary.contrastText}`,
              borderRadius: '10px',
              marginRight: '8px',
            }}
          />
        </Box>
      )}
    </>
  );
}
