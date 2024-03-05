import { ArrowForward } from '@mui/icons-material';
import {
  Button,
  Card,
  CardActions,
  CardContent,
  Grid,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';

export default function LibraryIndexPage() {
  return (
    <>
      <Typography variant="h3" mb={2}>
        Library
      </Typography>
      <Grid
        container
        columns={{ sm: 8, md: 16 }}
        columnSpacing={2}
        rowSpacing={2}
      >
        <Grid item sm={16} md={8}>
          <Card sx={{ minWidth: 275, pb: 1, pr: 1 }}>
            <CardContent>
              <Typography variant="h5" component="div">
                Filler
              </Typography>
              <Typography variant="body2">
                Filler lists are collections of videos that you may want to play
                during 'flex' time segments. Flex is time within a channel that
                does not have a program scheduled (usually used for padding).
              </Typography>
            </CardContent>
            <CardActions sx={{ justifyContent: 'right' }}>
              <Button
                size="small"
                variant="contained"
                component={Link}
                to="/library/fillers"
                endIcon={<ArrowForward />}
              >
                Edit Fillers
              </Button>
            </CardActions>
          </Card>
        </Grid>
        <Grid item sm={16} md={8}>
          <Card sx={{ minWidth: 275, pb: 1, pr: 1 }}>
            <CardContent>
              <Typography variant="h5" component="div">
                Custom Shows
              </Typography>
              <Typography variant="body2">
                Custom Shows are sequences of videos that represent a episodes
                of a virtual TV show. When you add these shows to a channel, the
                schedule tools will treat the videos as if they belonged to a
                single TV show.
              </Typography>
            </CardContent>
            <CardActions sx={{ justifyContent: 'right' }}>
              <Button
                size="small"
                variant="contained"
                component={Link}
                to="/library/custom-shows"
                endIcon={<ArrowForward />}
              >
                Edit Custom Shows
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
