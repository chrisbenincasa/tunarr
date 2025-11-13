import {
  getProgramDuration,
  getProgramRating,
  getProgramReleaseDate,
} from '@/helpers/programUtil';
import { Box, Typography, useTheme } from '@mui/material';
import { Link } from '@tanstack/react-router';
import {
  getChildCount,
  getChildItemType,
  type ProgramGrouping,
  type TerminalProgram,
} from '@tunarr/types';
import { capitalize, isUndefined } from 'lodash-es';
import pluralize from 'pluralize';
import React, { useMemo } from 'react';
import Genres from './Genres';

type Props = {
  program: TerminalProgram | ProgramGrouping;
  time?: string | null;
};

export default function ProgramInfoBar({ program, time }: Props) {
  const theme = useTheme();

  const seasonTitle = useMemo(() => {
    if (program.type === 'episode' && program?.season?.uuid) {
      return (
        <Link
          to={`/media/$programType/$programId`}
          params={{
            programType: 'season',
            programId: program?.season?.uuid,
          }}
          resetScroll={true}
          color="inherit"
          style={{ textDecoration: 'none' }}
        >
          <Typography
            variant="body1"
            color={'text.primary'}
            sx={{
              fontWeight: 500,
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            {program?.season?.title}
          </Typography>
        </Link>
      );
    } else if (program.type === 'season') {
      return (
        <Typography
          variant="body1"
          color={'text.primary'}
          sx={{ fontWeight: 500 }}
        >
          {program?.title}
        </Typography>
      );
    } else {
      return null;
    }
  }, [program]);

  const rating = useMemo(() => {
    const rating = getProgramRating(program);
    const queryStringValue = `rating = "${rating}"`;
    const searchParamsObject = {
      query: queryStringValue,
    };

    return (
      <Link
        to="/search"
        search={searchParamsObject}
        className="genre-link"
        style={{ textDecoration: 'none' }}
        resetScroll={true}
      >
        <Typography
          color={'text.primary'}
          sx={{
            border: '1px solid #777',
            px: 1,
            py: 0.2,
            borderRadius: 4,
            fontSize: '0.75rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            userSelect: 'none',
            '&:hover': {
              opacity: 0.9,
              color: theme.palette.getContrastText(theme.palette.grey[700]),
              backgroundColor: theme.palette.grey[700],
            },
          }}
        >
          {rating}
        </Typography>
      </Link>
    );
  }, [program, theme.palette]);

  const duration = useMemo(() => {
    return getProgramDuration(program);
  }, [program]);

  const genres = useMemo(() => {
    return <Genres program={program} />;
  }, [program]);

  const date = useMemo(() => {
    return getProgramReleaseDate(program);
  }, [program]);

  const source = useMemo(() => {
    return capitalize(program.sourceType);
  }, [program]);

  const childCount = useMemo(() => {
    const count = getChildCount(program);

    if (isUndefined(count)) {
      return;
    }

    const itemType = getChildItemType(program.type);

    return `${count} ${pluralize(itemType, count)}`;
  }, [program]);

  const itemInfoBar = useMemo(() => {
    let sortOrder;

    switch (program.type) {
      case 'show':
        sortOrder = [childCount, date, rating, genres, source];
        break;
      case 'season':
        sortOrder = [seasonTitle, childCount, rating, genres, source];
        break;
      case 'episode':
        sortOrder = [seasonTitle, duration, rating, genres, source];
        break;
      case 'movie':
        sortOrder = [duration, rating, date, source];
        break;
      case 'artist':
        sortOrder = [childCount, genres, source];
        break;
      case 'album':
        sortOrder = [childCount, genres, source];
        break;
      case 'track':
        sortOrder = [duration, date, source];
        break;
      case 'other_video':
        sortOrder = [date, source];
        break;
      case 'music_video':
        sortOrder = [date, source];
        break;
      default:
        sortOrder = [duration, rating, time, source, genres];
    }
    return sortOrder;
  }, [
    program,
    childCount,
    date,
    rating,
    genres,
    source,
    duration,
    time,
    seasonTitle,
  ]);

  return itemInfoBar.map((chip, index) => (
    <React.Fragment key={index}>
      <Box display="inline-block">{chip}</Box>
      {index < itemInfoBar.length - 1 && (
        <Box display="inline-block">&nbsp;&nbsp;&bull;&nbsp;&nbsp;</Box>
      )}
    </React.Fragment>
  ));
}
