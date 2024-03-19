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
import { useCallback } from 'react';
import { prettyItemDuration } from '../helpers/util';

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
  const rating = useCallback(
    forProgramType({
      custom: (p) => p.program?.rating ?? '',
      content: (p) => p.rating,
    }),
    [],
  );

  const summary = useCallback(
    forProgramType({
      custom: (p) => p.program?.summary ?? '',
      content: (p) => p.summary,
      default: '',
    }),
    [],
  );

  const durationChip = useCallback(
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

  const thumbnailImage = useCallback(
    forProgramType({
      content: (p) =>
        // TODO use typed APi
        p.id ? `http://localhost:8000/api/programs/${p.id}/thumb` : null,
    }),
    [],
  );

  const externalLink = useCallback(
    forProgramType({
      content: (p) =>
        p.id
          ? // TODO use typed APi
            `http://localhost:8000/api/programs/${p.id}/external-link`
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
