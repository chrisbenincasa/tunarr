import { useSettings } from '@/store/settings/selectors';
import { Box, Grid, Typography } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import type { Season, SeasonMetadata, Show } from '@tunarr/types';
import { useState } from 'react';

type Props = {
  program: Show;
};

export default function Seasons({ program }: Props) {
  const settings = useSettings();
  const navigate = useNavigate();

  const [posterError, setPosterError] = useState(false);

  const seasons = program.seasons ?? [];

  const handleNavigation = async (season: SeasonMetadata) => {
    await navigate({
      to: `/media/${season.type}/${season.uuid}`,
      replace: false,
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
        Seasons
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
        {seasons.map((season: Season, index: number) => (
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
                  width: 170,
                  height: 255,
                  boxShadow: 3,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '10px',
                  backgroundColor: 'grey.700',
                }}
                onClick={() => handleNavigation(season)}
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
                  alt={season.title}
                  component={'img'}
                  src={`${settings.backendUri}/api/programs/${season.uuid}/artwork/poster`}
                  sx={{
                    width: '100%',
                    height: 'auto',
                    boxShadow: 3,
                    borderRadius: '10px',
                  }}
                  onClick={() => handleNavigation(season)}
                  onError={() => setPosterError(true)}
                />
              </>
            )}
            <Typography
              variant="caption"
              component="h3"
              title={season.title}
              sx={{
                marginTop: 0.5,
                textAlign: 'center',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              {season.title}
            </Typography>
          </Box>
        ))}
      </Grid>
    </>
  );
}
