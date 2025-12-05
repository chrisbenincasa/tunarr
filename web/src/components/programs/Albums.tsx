import { useSettings } from '@/store/settings/selectors';
import { Box, Grid, Typography } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import type { MusicAlbum, MusicArtist } from '@tunarr/types';
import { useState } from 'react';

type Props = {
  program: MusicArtist;
};

export default function Albums({ program }: Props) {
  const settings = useSettings();
  const navigate = useNavigate();

  const [posterError, setPosterError] = useState(false);

  const albums =
    program.type === 'artist' && program.albums ? program.albums : [];

  const handleNavigation = async (album: MusicAlbum) => {
    await navigate({
      to: `/media/${album.type}/${album.uuid}`,
      replace: false,
      resetScroll: true,
    });
  };

  return (
    <>
      <Typography
        variant="h5"
        component="h5"
        color="text.primary"
        sx={{ mt: 4 }}
      >
        Albums
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
        {albums.length > 0 &&
          albums.map((album, index: number) => (
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
                    height: 255,
                    boxShadow: 3,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '10px',
                    backgroundColor: 'grey.700',
                  }}
                  onClick={() => handleNavigation(album)}
                >
                  <Typography
                    variant="h5"
                    component="span"
                    sx={{ color: 'white' }}
                  >
                    {`S${index + 1}`}
                  </Typography>
                </Box>
              ) : (
                <>
                  <Box
                    alt={album.title}
                    component={'img'}
                    src={`${settings.backendUri}/api/programs/${album.uuid}/artwork/poster`}
                    sx={{
                      width: '100%',
                      height: 'auto',
                      boxShadow: 3,
                      borderRadius: '10px',
                    }}
                    onClick={() => handleNavigation(album)}
                    onError={() => setPosterError(true)}
                  />

                  <Typography
                    variant="caption"
                    component="h3"
                    title={album.title}
                    sx={{
                      marginTop: 0.5,
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                    }}
                  >
                    {album.title}
                  </Typography>
                </>
              )}
            </Box>
          ))}
      </Grid>
    </>
  );
}
