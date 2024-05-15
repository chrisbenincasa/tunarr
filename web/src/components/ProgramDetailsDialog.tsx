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
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { createExternalId } from '@tunarr/shared';
import { forProgramType } from '@tunarr/shared/util';
import { ChannelProgram } from '@tunarr/types';
import { isUndefined } from 'lodash-es';
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
  program: ChannelProgram | undefined;
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
            color="primary"
            label={prettyItemDuration(program.duration)}
            sx={{ mt: 1 }}
          />
        ),
      }),
    [],
  );

  const ratingChip = useCallback(
    (program: ChannelProgram) => {
      const ratingString = rating(program);
      return ratingString ? (
        <Chip color="primary" label={ratingString} sx={{ mx: 1, mt: 1 }} />
      ) : null;
    },
    [rating],
  );

  const thumbnailImage = useMemo(
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
          if (p.subtype === 'track' && p.originalProgram?.type === 'track') {
            key = createExternalId(
              'plex',
              p.externalSourceName!,
              p.originalProgram.parentRatingKey,
            );
          }

          return `${settings.backendUri}/api/metadata/external?id=${key}&mode=proxy&asset=thumb`;
        },
      }),
    [],
  );

  const externalLink = useMemo(
    () =>
      forProgramType({
        content: (p) =>
          p.id && p.persisted
            ? `${settings.backendUri}/api/programs/${p.id}/external-link`
            : null,
      }),
    [],
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
  console.log(program);

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
            <Box>
              {durationChip(program)}
              {ratingChip(program)}
            </Box>
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
                {(thumbLoadState === 'loading' ||
                  thumbLoadState === 'error') && (
                  <Skeleton
                    variant="rectangular"
                    width={imageWidth}
                    height={500}
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
                {externalUrl && (
                  <Button
                    component="a"
                    target="_blank"
                    href={externalUrl}
                    size="small"
                    endIcon={<OpenInNew />}
                    variant="contained"
                  >
                    View in Plex
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
