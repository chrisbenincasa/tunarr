import { getProgramSummary } from '@/helpers/programUtil.ts';
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
import { type ProgramGrouping, type TerminalProgram } from '@tunarr/types';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { capitalize } from 'lodash-es';
import type { ReactEventHandler } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../store/settings/selectors.ts';
import ProgramInfoBar from './programs/ProgramInfoBar.tsx';

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

  const programLink = useMemo(() => {
    return `${window.location.origin}/web/media/${program.type}/${program.uuid}`;
  }, [program]);

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

  const summary = useMemo(() => {
    return getProgramSummary(program);
  }, [program]);

  const time = useMemo(() => {
    if (start && stop) {
      return `${dayjs(start).format('LT')} - ${dayjs(stop).format('LT')}`;
    }

    return null;
  }, [start, stop]);

  // This gives us the ability to change the sort order of the itemInfoBar on a per item basis
  // const itemInfoBar = useMemo(() => {
  //   let sortOrder;

  //   switch (program.type) {
  //     case 'show':
  //       sortOrder = [childCount, date, rating, genres, source]; // see why rating doesnt work
  //       break;
  //     case 'season':
  //       sortOrder = [childCount, rating, genres, source];
  //       break;
  //     case 'episode':
  //       sortOrder = [duration, rating, genres, source];
  //       break;
  //     case 'movie':
  //       sortOrder = [duration, rating, date, source]; // Movies currently missing genres https://github.com/chrisbenincasa/tunarr/issues/1461
  //       break;
  //     case 'artist':
  //       sortOrder = [childCount, genres, source];
  //       break;
  //     case 'album':
  //       sortOrder = [childCount, genres, source];
  //       break;
  //     case 'track':
  //       sortOrder = [duration, date, source];
  //       break;
  //     case 'other_video':
  //       sortOrder = [date, source];
  //       break;
  //     case 'music_video':
  //       sortOrder = [date, source];
  //       break;
  //     default:
  //       sortOrder = [duration, rating, time, source, genres];
  //   }

  //   return sortOrder.filter(Boolean);
  // }, [program.type, duration, date, rating, time, source, genres, childCount]);

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
          {externalLink && program.sourceType !== 'local' && (
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
          <Button
            component="a"
            href={programLink}
            size="small"
            variant="contained"
            fullWidth
            sx={{ mt: 1 }}
          >
            View Full Details
          </Button>
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
            <ProgramInfoBar program={program} time={time} />
            {/* {itemInfoBar.map((chip, index) => (
              <React.Fragment key={index}>
                {chip}
                {index < itemInfoBar.length - 1 && (
                  <span className="separator">
                    &nbsp;&nbsp;&bull;&nbsp;&nbsp;
                  </span>
                )}
              </React.Fragment>
            ))} */}
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
