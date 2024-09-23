import JellyfinIcon from '@/assets/jellyfin.svg?react';
import PlexIcon from '@/assets/plex.svg?react';
import { Maybe } from '@/types/util.ts';
import { Close as CloseIcon, OpenInNew } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Skeleton,
  Stack,
  SvgIcon,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { createExternalId } from '@tunarr/shared';
import { forProgramType } from '@tunarr/shared/util';
import {
  ChannelProgram,
  TvGuideProgram,
  isContentProgram,
} from '@tunarr/types';
import dayjs, { Dayjs } from 'dayjs';
import { capitalize, compact, find, isUndefined } from 'lodash-es';
import {
  ReactEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isNonEmptyString, prettyItemDuration } from '../helpers/util';
import { useSettings } from '../store/settings/selectors';

type Props = {
  open: boolean;
  onClose: () => void;
  program: TvGuideProgram | ChannelProgram | undefined;
  start?: Dayjs;
  stop?: Dayjs;
};

const formattedTitle = forProgramType({
  content: (p) => p.title,
  custom: (p) => p.program?.title ?? 'Custom Program',
  redirect: (p) => `Redirect to Channel ${p.channel}`,
  flex: 'Flex',
});

type ThumbLoadState = 'loading' | 'error' | 'success';

export default function ProgramDetailsDialog({
  open,
  onClose,
  start,
  stop,
  program,
}: Props) {
  const settings = useSettings();
  const [thumbLoadState, setThumbLoadState] =
    useState<ThumbLoadState>('loading');
  const imageRef = useRef<HTMLImageElement>(null);
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));

  const rating = useMemo(
    () =>
      forProgramType({
        custom: (p) => p.program?.rating ?? '',
        content: (p) => p.rating,
      }),
    [],
  );

  const summary = useMemo(
    () =>
      forProgramType({
        custom: (p) => p.program?.summary ?? '',
        content: (p) => p.summary,
        default: '',
      }),
    [],
  );

  const episodeTitle = useMemo(
    () =>
      forProgramType({
        custom: (p) => p.program?.episodeTitle ?? '',
        content: (p) => p.episodeTitle,
        default: '',
      }),
    [],
  );

  const durationChip = useMemo(
    () =>
      forProgramType({
        content: (program) => (
          <Chip
            key="duration"
            color="primary"
            label={prettyItemDuration(program.duration)}
            sx={{ mt: 1, mr: 1 }}
          />
        ),
      }),
    [],
  );

  const ratingChip = useCallback(
    (program: ChannelProgram) => {
      const ratingString = rating(program);
      return ratingString ? (
        <Chip
          key="rating"
          color="primary"
          label={ratingString}
          sx={{ mr: 1, mt: 1 }}
        />
      ) : null;
    },
    [rating],
  );

  const sourceChip = useCallback((program: ChannelProgram) => {
    if (isContentProgram(program)) {
      const id = find(
        program.externalIds,
        (eid) =>
          eid.type === 'multi' &&
          (eid.source === 'jellyfin' || eid.source === 'plex'),
      );
      if (!id) {
        return null;
      }

      let icon: Maybe<JSX.Element> = undefined;
      switch (id.source) {
        case 'jellyfin':
          icon = <JellyfinIcon />;
          break;
        case 'plex':
          icon = <PlexIcon />;
          break;
        default:
          break;
      }

      if (icon) {
        return (
          <Chip
            key="source"
            color="primary"
            icon={<SvgIcon>{icon}</SvgIcon>}
            label={capitalize(id.source)}
            sx={{ mr: 1, mt: 1 }}
          />
        );
      }
    }

    return null;
  }, []);

  const timeChip = () => {
    if (start && stop) {
      return (
        <Chip
          key="time"
          label={`${dayjs(start).format('h:mm')} - ${dayjs(stop).format(
            'h:mma',
          )}`}
          sx={{ mt: 1, mr: 1 }}
          color="primary"
        />
      );
    }

    return null;
  };

  const chips = (program: ChannelProgram) => {
    return compact([
      durationChip(program),
      ratingChip(program),
      timeChip(),
      sourceChip(program),
    ]);
  };

  const thumbnailImage: (m: ChannelProgram) => string | null = useMemo(
    () =>
      forProgramType({
        content: (p) => {
          let url: string | undefined;
          if (p.persisted) {
            let id: string | undefined = p.id;
            if (p.subtype === 'track' && isNonEmptyString(p.albumId)) {
              id = p.albumId;
            }
            url = `${settings.backendUri}/api/programs/${id}/thumb?proxy=true`;
          }

          if (isNonEmptyString(url)) {
            return url;
          }

          let key = p.uniqueId;
          if (p.subtype === 'track' && p.originalProgram) {
            switch (p.originalProgram.sourceType) {
              case 'plex': {
                if (
                  p.originalProgram.program.type === 'track' &&
                  isNonEmptyString(p.originalProgram.program.parentRatingKey)
                ) {
                  key = createExternalId(
                    p.originalProgram?.sourceType,
                    p.externalSourceName!,
                    p.originalProgram.program.parentRatingKey,
                  );
                }
                break;
              }
              case 'jellyfin': {
                if (
                  p.originalProgram.program.Type === 'Audio' &&
                  isNonEmptyString(p.originalProgram.program.AlbumId)
                ) {
                  key = createExternalId(
                    p.originalProgram.sourceType,
                    p.externalSourceName!,
                    p.originalProgram.program.AlbumId,
                  );
                }
                break;
              }
            }
          }

          return `${settings.backendUri}/api/metadata/external?id=${key}&mode=proxy&asset=thumb`;
        },
        custom: (p) => (p.program ? thumbnailImage(p.program) : null),
      }),
    [settings.backendUri],
  );

  const externalLink = useMemo(
    () =>
      forProgramType({
        content: (p) =>
          p.id && p.persisted
            ? `${settings.backendUri}/api/programs/${p.id}/external-link`
            : null,
      }),
    [settings.backendUri],
  );

  const thumbUrl = program ? thumbnailImage(program) : null;
  const externalUrl = program ? externalLink(program) : null;
  const programSummary = program ? summary(program) : null;
  const programEpisodeTitle = program ? episodeTitle(program) : null;

  useEffect(() => {
    setThumbLoadState('loading');
  }, [thumbUrl]);

  const onLoad = useCallback(() => {
    setThumbLoadState('success');
  }, [setThumbLoadState]);

  const onError: ReactEventHandler<HTMLImageElement> = useCallback((e) => {
    console.error(e);
    setThumbLoadState('error');
  }, []);

  const isEpisode =
    program && program.type === 'content' && program.subtype === 'episode';
  const imageWidth = smallViewport ? (isEpisode ? '100%' : '55%') : 240;

  let externalSourceName: string = '';
  if (program) {
    switch (program.type) {
      case 'content': {
        const eid = find(
          program.externalIds,
          (eid) =>
            eid.type === 'multi' &&
            (eid.source === 'plex' || eid.source === 'jellyfin'),
        );
        if (eid) {
          switch (eid.source) {
            case 'plex':
              externalSourceName = 'Plex';
              break;
            case 'jellyfin':
              externalSourceName = 'Jellyfin';
              break;
          }
        }
        break;
      }
      default:
        break;
    }
  }

  return (
    program && (
      <Dialog
        open={open && !isUndefined(program)}
        onClose={onClose}
        fullScreen={smallViewport}
      >
        <DialogTitle variant="h4" sx={{ marginRight: 3 }}>
          {formattedTitle(program)}{' '}
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => onClose()}
            aria-label="close"
            sx={{ position: 'absolute', top: 10, right: 10 }}
            size="large"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Box>{chips(program)}</Box>
            <Stack
              direction="row"
              spacing={smallViewport ? 0 : 2}
              flexDirection={smallViewport ? 'column' : 'row'}
            >
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  component="img"
                  width={imageWidth}
                  src={thumbUrl ?? ''}
                  alt={formattedTitle(program)}
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
                      program.type === 'content' && program.subtype === 'movie'
                        ? 360
                        : smallViewport
                        ? undefined
                        : 140
                    }
                    animation={thumbLoadState === 'loading' ? 'pulse' : false}
                  ></Skeleton>
                )}
              </Box>
              <Box>
                {programEpisodeTitle ? (
                  <Typography variant="h5" sx={{ mb: 1 }}>
                    {programEpisodeTitle}
                  </Typography>
                ) : null}
                {programSummary ? (
                  <Typography id="modal-modal-description" sx={{ mb: 1 }}>
                    {programSummary}
                  </Typography>
                ) : (
                  <Skeleton
                    animation={false}
                    variant="rectangular"
                    sx={{
                      backgroundColor: (theme) =>
                        theme.palette.background.default,
                    }}
                    width={imageWidth}
                  />
                )}
                {externalUrl && isNonEmptyString(externalSourceName) && (
                  <Button
                    component="a"
                    target="_blank"
                    href={externalUrl}
                    size="small"
                    endIcon={<OpenInNew />}
                    variant="contained"
                  >
                    View in {externalSourceName}
                  </Button>
                )}
              </Box>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    )
  );
}
