import { getProgramGenres } from '@/helpers/programUtil';
import { useIsDarkMode } from '@/hooks/useTunarrTheme';
import { Box, Tooltip, Typography, useTheme } from '@mui/material';
import { Link } from '@tanstack/react-router';
import type { Genre, ProgramGrouping, TerminalProgram } from '@tunarr/types';
import React, { useMemo } from 'react';

type Props = {
  program: TerminalProgram | ProgramGrouping;
};

export default function Genres({ program }: Props) {
  const darkMode = useIsDarkMode();
  const theme = useTheme();
  const genreData = useMemo(() => {
    return getProgramGenres(program) || [];
  }, [program]);

  const MAX_GENRES_TO_SHOW = 3;
  const visibleGenres = genreData.slice(0, MAX_GENRES_TO_SHOW);
  const hiddenGenres = genreData.slice(MAX_GENRES_TO_SHOW);
  const hasOverflow = hiddenGenres.length > 0;

  const renderGenreLink = (genre: Genre, location?: string) => {
    const genreName = genre.name;
    const queryStringValue = `genre IN [${genreName}]`;
    const searchParamsObject = {
      query: queryStringValue,
    };

    return (
      <Link
        to="/search"
        search={searchParamsObject}
        className="genre-link"
        key={genreName}
        style={{
          textDecoration: 'none',
          display: 'inline-block',
        }}
        resetScroll={true}
      >
        <Typography
          component="span"
          color={
            location === 'tooltip'
              ? darkMode
                ? 'text.primary'
                : theme.palette.getContrastText(theme.palette.grey[700])
              : 'text.primary'
          }
          sx={{
            fontWeight: 500,
            display: 'inline-block',
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline',
            },
          }}
        >
          {genreName}
        </Typography>
      </Link>
    );
  };

  const tooltipContent = (
    <Typography
      component="div"
      sx={{ padding: 0 }}
      color={
        darkMode
          ? 'text.primary'
          : theme.palette.getContrastText(theme.palette.grey[900])
      }
    >
      {hiddenGenres.map((genre: Genre, index: number) => (
        <React.Fragment key={genre.name}>
          {renderGenreLink(genre, 'tooltip')}
          {index < hiddenGenres.length - 1 ? ', ' : ''}
        </React.Fragment>
      ))}
    </Typography>
  );

  return genreData && genreData?.length > 0 ? (
    <Box display={'inline-block'}>
      {visibleGenres.map((genre: Genre, index: number) => (
        <React.Fragment key={genre.name}>
          {renderGenreLink(genre)}
          {index < visibleGenres.length - 1 ? ', ' : ''}
        </React.Fragment>
      ))}
      {hasOverflow && (
        <Tooltip
          title={tooltipContent}
          arrow
          slotProps={{
            tooltip: {
              sx: {
                backgroundColor: theme.palette.grey[700],
                padding: '4px 8px',
              },
            },
          }}
        >
          <Typography
            component="span"
            sx={{
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            , ...
          </Typography>
        </Tooltip>
      )}
    </Box>
  ) : null;
}
