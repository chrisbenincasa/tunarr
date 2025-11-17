import { prettyItemDuration } from '@/helpers/util.ts';
import { OpenInNew } from '@mui/icons-material';
import {
  Box,
  Button,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  getChildCount,
  getChildItemType,
  isTerminalItemType,
  type ProgramGrouping,
  type TerminalProgram,
} from '@tunarr/types';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { capitalize, isUndefined } from 'lodash-es';
import pluralize from 'pluralize';
import type { ReactEventHandler } from 'react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { match, P } from 'ts-pattern';
import { useSettings } from '../store/settings/selectors.ts';
import type { Maybe } from '../types/util.ts';

type Props = {
  program: TerminalProgram | ProgramGrouping;
  start?: Dayjs;
  stop?: Dayjs;
};

type ThumbLoadState = 'loading' | 'error' | 'success';

export const ProgramMetadataDialogContent = ({
  program,
  start,
  stop,
}: Props) => {
  const settings = useSettings();
  const [thumbLoadState, setThumbLoadState] =
    useState<ThumbLoadState>('loading');

  const imageRef = useRef<HTMLImageElement>(null);
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const isEpisode = program && program.type === 'episode';
  const imageWidth = smallViewport ? (isEpisode ? '100%' : '55%') : 240;

  const thumbnailImage = useMemo(() => {
    return `${settings.backendUri}/api/programs/${program.uuid}/artwork/poster`;
  }, [settings.backendUri, program]);

  const externalLink = useMemo(() => {
    return `${settings.backendUri}/api/programs/${program.uuid}/external-link`;
  }, [settings.backendUri, program]);

  useEffect(() => {
    setThumbLoadState('loading');
  }, [thumbnailImage]);

  const onLoad = useCallback(() => {
    setThumbLoadState('success');
  }, [setThumbLoadState]);

  const onError: ReactEventHandler<HTMLImageElement> = useCallback((e) => {
    console.error(e);
    setThumbLoadState('error');
  }, []);

  const rating = useMemo(() => {
    if (program.type === 'episode' || program.type === 'season') {
      return program.show?.rating;
    }

    if (program.type === 'show' || program.type === 'movie') {
      return program.rating;
    }
  }, [program]);

  const summary = useMemo(() => {
    switch (program.type) {
      case 'movie':
      case 'show':
        return program.plot ?? program.summary;
      case 'episode':
        return program.summary;
      case 'season':
        return program.show?.plot;
      case 'artist':
        return program.summary;
      case 'album':
        return program.plot;
      default:
        return '';
    }
  }, [program]);

  const genres = useMemo(() => {
    return match(program)
      .returnType<Maybe<string>>()
      .with(
        { type: P.union('episode', 'season'), show: P.nonNullable },
        ({ show }) =>
          show.genres
            .map((g) => g.name)
            .slice(0, 3)
            .join(', '),
      )
      .with(
        { type: P.union('album', 'track'), artist: P.nonNullable },
        ({ artist }) =>
          artist.genres
            ?.map((g) => g.name)
            .slice(0, 3)
            .join(', '),
      )
      .with({ genres: [P._, ...P.array()] }, ({ genres }) =>
        genres
          .map((g) => g.name)
          .slice(0, 3)
          .join(','),
      )
      .otherwise(() => undefined);
  }, [program]);

  const duration = useMemo(() => {
    if (isTerminalItemType(program)) {
      return prettyItemDuration(program.duration);
    }

    return;
  }, [program]);

  const date = useMemo(() => {
    let dateValue;
    const dateFormat = 'MMMM D, YYYY';

    switch (program.type) {
      case 'movie':
      case 'show':
      case 'other_video':
      case 'music_video':
        dateValue = program.year;
        break;
      case 'season':
        dateValue = program.show?.releaseDate
          ? dayjs(program.show?.releaseDate).format(dateFormat)
          : '';
        break;
      case 'episode':
      case 'album':
      case 'track':
        dateValue = program.releaseDate
          ? dayjs(program.releaseDate).format(dateFormat)
          : '';
        break;
      default:
        return '';
    }

    return dateValue;
  }, [program]);

  const source = useMemo(() => {
    return capitalize(program.sourceType);
  }, [program]);

  const time = useMemo(() => {
    if (start && stop) {
      return `${dayjs(start).format('LT')} - ${dayjs(stop).format('LT')}`;
    }

    return null;
  }, [start, stop]);
  console.log(program);

  const childCount = useMemo(() => {
    const count = getChildCount(program);

    if (isUndefined(count)) {
      return;
    }

    const itemType = getChildItemType(program.type);

    return `${count} ${pluralize(itemType, count)}`;
  }, [program]);

  // This gives us the ability to change the sort order of the itemInfoBar on a per item basis
  const itemInfoBar = useMemo(() => {
    let sortOrder;

    switch (program.type) {
      case 'show':
        sortOrder = [childCount, date, rating, genres, source]; // see why rating doesnt work
        break;
      case 'season':
        sortOrder = [childCount, rating, genres, source];
        break;
      case 'episode':
        sortOrder = [duration, rating, genres, source];
        break;
      case 'movie':
        sortOrder = [duration, rating, date, source]; // Movies currently missing genres https://github.com/chrisbenincasa/tunarr/issues/1461
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

    return sortOrder.filter(Boolean);
  }, [program.type, duration, date, rating, time, source, genres, childCount]);

  const displayTitle = !smallViewport ? program.title : null;

  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        spacing={smallViewport ? 0 : 2}
        flexDirection={smallViewport ? 'column' : 'row'}
      >
        <Box
          sx={{
            textAlign: 'center',
            flex: smallViewport ? undefined : '0 0 25%',
          }}
        >
          <Box
            component="img"
            width={imageWidth}
            src={thumbnailImage ?? ''}
            alt={program.title}
            onLoad={onLoad}
            ref={imageRef}
            sx={{
              display: thumbLoadState !== 'success' ? 'none' : undefined,
              borderRadius: '10px',
            }}
            onError={onError}
          />
          {thumbLoadState !== 'success' && (
            <Skeleton
              variant="rectangular"
              width={smallViewport ? '100%' : imageWidth}
              height={
                program.type === 'movie' ||
                program.type === 'show' ||
                program.type === 'season'
                  ? 360
                  : smallViewport
                    ? undefined
                    : 140
              }
              animation={thumbLoadState === 'loading' ? 'pulse' : false}
            ></Skeleton>
          )}
          {externalLink && (
            <Button
              component="a"
              target="_blank"
              href={externalLink}
              size="small"
              endIcon={<OpenInNew />}
              variant="contained"
              fullWidth
              sx={{ mt: 1 }}
            >
              View in {capitalize(program.sourceType)}
            </Button>
          )}
        </Box>
        <Box>
          {displayTitle ? (
            <Typography variant="h5" sx={{ mb: 1 }}>
              {displayTitle}
            </Typography>
          ) : null}

          <Box
            sx={{
              borderTop: `1px solid`,
              borderBottom: `1px solid`,
              my: 1,
              textAlign: ['center', 'left'],
            }}
          >
            {itemInfoBar.map((chip, index) => (
              <React.Fragment key={index}>
                {chip}
                {index < itemInfoBar.length - 1 && (
                  <span className="separator">
                    &nbsp;&nbsp;&bull;&nbsp;&nbsp;
                  </span>
                )}
              </React.Fragment>
            ))}
          </Box>
          {summary ? (
            <Typography id="modal-modal-description" sx={{ mb: 1 }}>
              {summary}
            </Typography>
          ) : (
            <Skeleton
              animation={false}
              variant="rectangular"
              sx={{
                backgroundColor: (theme) => theme.palette.background.default,
              }}
              width={imageWidth}
            />
          )}
        </Box>
      </Stack>
    </Stack>
  );
};
