import {
  Card,
  CardActions,
  CardContent,
  CardProps,
  Typography,
} from '@mui/material';
import AddPlexServer from './AddPlexServer.tsx';

export default function ConnectPlex(props: CardProps) {
  const {
    sx = {
      p: 2,
      margin: '0 auto',
      textAlign: 'center',
    },
    ...restProps
  } = props;

  return (
    <Card sx={sx} {...restProps}>
      <CardContent>
        <img src="/web/src/assets/plex.svg" width="75" />
        <Typography sx={{ my: 2 }}>
          First things first, let's get your Plex Server connected.
        </Typography>
        <CardActions sx={{ justifyContent: 'center' }}>
          <AddPlexServer title="Connect Plex" />
        </CardActions>
      </CardContent>
    </Card>
  );
}
