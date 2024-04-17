import { OpenInNew } from '@mui/icons-material';
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Skeleton,
  Stack,
  Typography,
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
  const [thumbLoadState, setThumbLoadState] =
    useState<ThumbLoadState>('loading');
  const imageRef = useRef<HTMLImageElement>(null);

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

  const durationChip = useMemo(
    () =>
      forProgramType({
        content: (program) => (
          <Chip
            color="secondary"
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
        <Chip color="secondary" label={ratingString} sx={{ mx: 1, mt: 1 }} />
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
            url = `http://localhost:8000/api/programs/${id}/thumb?proxy=true`;
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

          return `http://localhost:8000/api/metadata/external?id=${key}&mode=proxy&asset=thumb`;
        },
      }),
    [],
  );

  const externalLink = useMemo(
    () =>
      forProgramType({
        content: (p) =>
          p.id && p.persisted
            ? `http://localhost:8000/api/programs/${p.id}/external-link`
            : null,
      }),
    [],
  );

  const thumbUrl = program ? thumbnailImage(program) : null;
  const externalUrl = program ? externalLink(program) : null;
  const programSummary = program ? summary(program) : null;

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

  return (
    program && (
      <Dialog open={open && !isUndefined(program)} onClose={onClose}>
        <DialogTitle>
          {formattedTitle(program)}{' '}
          {externalUrl && (
            <IconButton
              component="a"
              target="_blank"
              href={externalUrl}
              size="small"
            >
              <OpenInNew />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Box>
              {durationChip(program)}
              {ratingChip(program)}
            </Box>
            <Stack direction="row" spacing={2}>
              <Box>
                <Box
                  component="img"
                  width={240}
                  src={thumbUrl ?? ''}
                  alt={formattedTitle(program)}
                  onLoad={onLoad}
                  ref={imageRef}
                  sx={{
                    display: thumbLoadState !== 'success' ? 'none' : undefined,
                  }}
                  onError={onError}
                />
                {(thumbLoadState === 'loading' ||
                  thumbLoadState === 'error') && (
                  <Skeleton
                    variant="rectangular"
                    width={240}
                    height={360}
                    animation={thumbLoadState === 'loading' ? 'pulse' : false}
                  ></Skeleton>
                )}
              </Box>
              <Box>
                {programSummary ? (
                  <Typography id="modal-modal-description" sx={{ mt: 1 }}>
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
                    width={240}
                  />
                )}
              </Box>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    )
  );
}
