import { Trans } from '@lingui/react/macro';
import { List, ListItem, ListItemText, Typography } from '@mui/material';
import type { MusicAlbum } from '@tunarr/types';
import dayjs from 'dayjs';

type Props = {
  program: MusicAlbum;
};

export default function Tracks({ program }: Props) {
  const tracks = program.tracks ?? [];

  return (
    <>
      <Typography
        variant="h5"
        component="h5"
        color="text.primary"
        sx={{ mt: 4 }}
      >
        <Trans>Tracks</Trans>
      </Typography>
      <List>
        {tracks.map((track) => (
          <ListItem key={track.uuid}>
            <ListItemText
              sx={{ flex: 1 }}
              primary={`${track.trackNumber}. ${track.title}`}
            />
            <ListItemText
              sx={{ alignSelf: 'flex-end', flex: '0 1 auto' }}
              primary={dayjs.duration(track.duration).format('mm:ss')}
            />
          </ListItem>
        ))}
      </List>
    </>
  );
}
