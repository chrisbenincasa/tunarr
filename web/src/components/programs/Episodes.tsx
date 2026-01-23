import { InfoSharp } from '@mui/icons-material';
import { Box, Grid, Typography } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import type { Episode, EpisodeMetadata, Season } from '@tunarr/types';
import { useCallback, useState } from 'react';
import { useGetArtworkUrl } from '../../hooks/useThumbnailUrl.ts';
import ProgramDetailsDialog from './ProgramDetailsDialog.tsx';

type Props = {
  program: Season;
};

export default function Episodes({ program }: Props) {
  const navigate = useNavigate();

  const [posterError, setPosterError] = useState(false);
  const [episodeDialogOpen, setEpisodeDialogOpen] = useState<string | null>(
    null,
  );

  const episodes =
    program.type === 'season' && program.episodes ? program.episodes : [];

  const handleNavigation = async (episode: EpisodeMetadata) => {
    await navigate({
      to: `/media/${episode.type}/${episode.uuid}`,
      replace: false,
      resetScroll: true,
    });
  };

  const getArtworkUrl = useGetArtworkUrl();

  const showInfo = useCallback((e: React.SyntheticEvent, episode: Episode) => {
    e.preventDefault();
    e.stopPropagation();
    setEpisodeDialogOpen(episode.uuid);
  }, []);

  return (
    <>
      <Typography
        variant="h5"
        component="h5"
        color="text.primary"
        sx={{ mt: 4 }}
      >
        Episodes
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
        {episodes.map((episode: Episode, index: number) => (
          <Box
            key={index}
            sx={{
              width: '100%',
              transition: 'transform 0.2s',
              cursor: 'pointer',
              '&:hover': {
                transform: 'scale(1.05)',
              },
              position: 'relative',
            }}
          >
            <InfoSharp
              inheritViewBox
              onClick={(e) => showInfo(e, episode)}
              sx={{
                position: 'absolute',
                zIndex: 10,
                top: 8,
                right: 8,
                cursor: 'pointer',
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(0, 0, 0, 0.7)'
                    : 'rgba(255, 255, 255, 0.7)',
                borderRadius: '50%',
                '&:hover': {
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(0, 0, 0, 0.7)'
                      : 'rgba(255, 255, 255, 0.7)',
                },
              }}
            />
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
                onClick={() => handleNavigation(episode)}
              >
                <Typography
                  variant="h5"
                  component="span"
                  sx={{ color: 'white' }}
                >
                  {`Episode ${index + 1}`}
                </Typography>
              </Box>
            ) : (
              <>
                <Box
                  alt={episode.title}
                  component={'img'}
                  src={getArtworkUrl(episode) ?? undefined}
                  sx={{
                    width: '100%',
                    height: 'auto',
                    boxShadow: 3,
                    borderRadius: '10px',
                  }}
                  onClick={() => handleNavigation(episode)}
                  onError={() => setPosterError(true)}
                />

                <Typography
                  variant="caption"
                  component="h3"
                  title={episode.title}
                  sx={{
                    marginTop: 0.5,
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                  }}
                >
                  {episode.season
                    ? Math.max(episode.season.index, 0) * episode.episodeNumber
                    : ''}
                  {episode.title}
                </Typography>
              </>
            )}
          </Box>
        ))}
      </Grid>
      <ProgramDetailsDialog
        open={!!episodeDialogOpen}
        onClose={() => setEpisodeDialogOpen(null)}
        programId={episodeDialogOpen ?? ''}
        programType={'episode'}
        panelVisibility={{ metadata: true }}
      />
    </>
  );
}
