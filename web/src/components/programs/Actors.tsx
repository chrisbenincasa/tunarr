import {
  Avatar,
  Box,
  Button,
  Grid,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Link } from '@tanstack/react-router';
import type { ProgramGrouping, TerminalProgram } from '@tunarr/types';
import { useState } from 'react';
import { useGetPersonArtwork } from '../../hooks/useThumbnailUrl.ts';

type Props = {
  program: TerminalProgram | ProgramGrouping;
};

export default function Actors({ program }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const initialItemsToShow: number = 14; // to do: actually check how many items are needed to fill a row based on current screen dimensions
  const itemsToLoad: number = initialItemsToShow;
  const [visibleCount, setVisibleCount] = useState<number>(initialItemsToShow);

  const thumbnailUrlFunc = useGetPersonArtwork();

  const getActors = () => {
    switch (program?.type) {
      case 'season':
        return program?.show?.actors;
      case 'episode':
      case 'show':
      case 'movie':
        return program?.actors;
      default:
        return undefined;
    }
  };

  const allActors = getActors();
  const actors = allActors?.slice(0, visibleCount);
  const hasMore = allActors && allActors.length > visibleCount;

  const handleLoadMore = () => {
    setVisibleCount((prevCount) => prevCount + itemsToLoad);
  };

  return actors && actors?.length > 0 ? (
    <>
      <Typography
        variant="h5"
        component="h5"
        color="text.primary"
        sx={{ mt: 4 }}
      >
        Cast & Crew
      </Typography>
      <Grid
        container
        component="div"
        spacing={2}
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 100 : 175}px, 1fr))`,
          justifyContent: 'space-around',
          mt: 2,
        }}
      >
        {actors.map((actor, index) => {
          const actorName = actor.name;
          const queryStringValue = `actor = "${actorName}"`;
          const searchParamsObject = {
            query: queryStringValue,
          };

          return (
            <Box
              key={index}
              sx={{
                width: '100%',
                transition: 'transform 0.2s',
                cursor: 'pointer',
                '&:hover': {
                  transform: 'scale(1.05)',
                },
              }}
            >
              <Link
                to="/search"
                search={searchParamsObject}
                className="genre-link"
                style={{ textDecoration: 'none' }}
                resetScroll={true}
              >
                <Avatar
                  alt={actor.name}
                  src={
                    thumbnailUrlFunc(actor, 'thumbnail') ??
                    actor.thumb ??
                    undefined
                  }
                  sx={{
                    width: '100%',
                    height: 'auto',
                    aspectRatio: '1 / 1',
                    boxShadow: 3,
                  }}
                >
                  <Typography variant="h2">{actor.name.charAt(0)}</Typography>
                </Avatar>

                <Typography
                  variant="caption"
                  component="h3"
                  title={actor.name}
                  color={'text.primary'}
                  sx={{
                    marginTop: 0.5,
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                    textAlign: 'center',
                  }}
                >
                  {actor.name}
                </Typography>

                <Typography
                  variant="caption"
                  component="h3"
                  title={actor.name}
                  color={'text.primary'}
                  sx={{
                    fontStyle: 'italic',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                    textAlign: 'center',
                  }}
                >
                  {actor.role}
                </Typography>
              </Link>
            </Box>
          );
        })}
      </Grid>
      {/* Show the "Load More" button only if there are more actors to display */}
      {hasMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 2 }}>
          <Button variant="outlined" onClick={handleLoadMore}>
            Load More
          </Button>
        </Box>
      )}
    </>
  ) : null;
}
