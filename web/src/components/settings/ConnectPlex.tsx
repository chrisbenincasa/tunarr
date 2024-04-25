import {
  Box,
  CardActions,
  CardContent,
  CardProps,
  Typography,
} from '@mui/material';
import AddPlexServer from './AddPlexServer.tsx';
import plexSvg from '../../assets/plex.svg';

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
    <Box sx={sx} {...restProps}>
      <CardContent>
        <img src={plexSvg} width="75" />
        {/* <Typography sx={{ my: 2 }}>
          First things first, let's get your Plex Server connected.
        </Typography> */}
        <Typography align="center" variant="h6">
          No Plex Servers Connected
        </Typography>
        <CardActions sx={{ justifyContent: 'center' }}>
          <AddPlexServer title="Connect Plex Now" />
        </CardActions>
      </CardContent>
    </Box>
  );
}
