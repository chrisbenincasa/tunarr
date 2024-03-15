import { AddCircle, Delete } from '@mui/icons-material';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Box,
  Button,
  IconButton,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import { forProgramType } from '@tunarr/shared/util';
import { isPlexDirectory, isPlexSeason, isPlexShow } from '@tunarr/types/plex';
import { chain, first, groupBy, mapValues } from 'lodash-es';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
};

export default function SelectedProgrammingList({ onAddSelectedMedia }: Props) {
  const { data: customShows } = useCustomShows();
  const knownMedia = useStore((s) => s.knownMediaByServer);
  const selectedMedia = useStore((s) => s.selectedMedia);
  const darkMode = useStore((state) => state.theme.darkMode);
  const navigate = useNavigate();

  const customShowById = mapValues(
    mapValues(groupBy(customShows, 'id'), first),
    unwrapNil,
  );

  const removeAllItems = useCallback(() => {
    clearSelectedMedia();
  }, []);

  const formattedTitle = useCallback(
    forProgramType({
      content: (p) => p.title,
    }),
    [],
  );

  const formattedEpisodeTitle = useCallback(
    forProgramType({
      custom: (p) => p.program?.episodeTitle ?? '',
    }),
    [],
  );

  const renderSelectedItems = () => {
    const items = chain(selectedMedia)
      .map(
        forSelectedMediaType({
          plex: (selected) => {
            const media = knownMedia[selected.server][selected.guid];

            let title: string = media.title;
            if (isPlexDirectory(media)) {
              title = `Library - ${media.title}`;
            } else if (isPlexShow(media)) {
              title = `${media.title} (${media.childCount} season(s), ${media.leafCount} total episodes)`;
            } else if (isPlexSeason(media)) {
              title = `${media.parentTitle} - ${media.title} (${media.leafCount} episodes)`;
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
          'custom-show': (selected) => {
            const customShow = customShowById[selected.customShowId];
            return (
              customShow && (
                <ListItem key={`custom_${selected.program.id}`}>
                  Custom Show {customShow.name} -{' '}
                  {formattedTitle(selected.program)}{' '}
                  {formattedEpisodeTitle(selected.program)}
                </ListItem>
              )
            );
          },
        }),
      )
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
            backgroundColor: 'primary.main',
            color: '#fff',
            position: 'fixed',
            bottom: '1em',
            width: '500px',
            margin: '1em auto',
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
            {selectedMedia.length} Selected Programs{' '}
          </Typography>

          <Tooltip title="Unselect all programs">
            <Button
              startIcon={<Delete />}
              sx={{
                color: darkMode ? '#fff' : '#fff',
                border: '1px solid white',
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
            startIcon={<AddCircle />}
            onSuccess={() => navigate('..', { relative: 'path' })}
            sx={{
              color: '#fff',
              border: '1px solid white',
              borderRadius: '10px',
              marginRight: '8px',
            }}
          />
        </Box>
      )}
    </>
  );
}
