import { OpenInNew } from '@mui/icons-material';
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { forProgramType } from '@tunarr/shared/util';
import { ChannelProgram } from '@tunarr/types';
import { isUndefined } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { prettyItemDuration } from '../helpers/util';
import { createExternalId } from '@tunarr/shared';

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

export default function ProgramDetailsDialog({
  open,
  onClose,
  program,
}: Props) {
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
          if (p.id && p.persisted) {
            return `http://localhost:8000/api/programs/${p.id}/thumb`;
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

  if (isUndefined(program)) {
    return null;
  }

  const thumbUrl = thumbnailImage(program);
  const externalUrl = externalLink(program);

  return (
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
            {thumbUrl ? (
              <img
                width={240}
                src={thumbUrl}
                alt={formattedTitle(program)}
                loading="lazy"
              />
            ) : null}
            <Box>
              <Typography id="modal-modal-description" sx={{ mt: 1 }}>
                {summary(program)}
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
