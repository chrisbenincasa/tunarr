import { Box, Grid, Typography } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import type { MusicAlbum, MusicTrack } from '@tunarr/types';
import { useState } from 'react';
import { useGetArtworkUrl } from '../../hooks/useThumbnailUrl.ts';

type Props = {
  program: MusicAlbum;
};

export default function Tracks({ program }: Props) {
  const navigate = useNavigate();

  const [posterError, setPosterError] = useState(false);

  const tracks = program.tracks ?? [];

  const handleNavigation = async (track: MusicTrack) => {
    await navigate({
      to: `/media/${track.type}/${track.uuid}`,
      replace: false,
      resetScroll: true,
    });
  };

  const getArtworkUrl = useGetArtworkUrl();

  return (
    <>
      <Typography
        variant="h5"
        component="h5"
        color="text.primary"
        sx={{ mt: 4 }}
      >
        Tracks
      </Typography>
      <Grid
        container
        component="div"
        spacing={2}
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
          justifyContent: 'space-around',
          mt: 2,
        }}
      >
        {tracks.length > 0 &&
          tracks.map((track: MusicTrack, index: number) => (
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
              {posterError ? (
                <Box
                  sx={{
                    width: 175,
                    height: 175,
                    boxShadow: 3,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '10px',
                    backgroundColor: 'grey.700',
                  }}
                  onClick={() => handleNavigation(track)}
                >
                  <Typography
                    variant="h5"
                    component="span"
                    sx={{ color: 'white' }}
                  >
                    {`Track ${index + 1}`}
                  </Typography>
                </Box>
              ) : (
                <>
                  <Box
                    alt={track.title}
                    component={'img'}
                    src={getArtworkUrl(track) ?? undefined}
                    sx={{
                      width: '100%',
                      height: 'auto',
                      boxShadow: 3,
                      borderRadius: '10px',
                    }}
                    onClick={() => handleNavigation(track)}
                    onError={() => setPosterError(true)}
                  />

                  <Typography
                    variant="caption"
                    component="h3"
                    title={track.title}
                    sx={{
                      marginTop: 0.5,
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                    }}
                  >
                    {track.title}
                  </Typography>
                </>
              )}
            </Box>
          ))}
      </Grid>
    </>
  );
}
