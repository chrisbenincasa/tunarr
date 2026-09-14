import { useLingui } from '@lingui/react/macro';
import { Chip, Tooltip } from '@mui/material';
import { useDayjs } from '../hooks/useDayjs.ts';

type Props = {
  unavailableSince: number;
};

export const UnavailableLibraryChip = ({ unavailableSince }: Props) => {
  const { t } = useLingui();
  const dayjs = useDayjs();
  const since = dayjs(unavailableSince).format('LLL');

  return (
    <Tooltip
      placement="top"
      title={t`The media server stopped reporting this library on ${since}. Its programs and channel schedules are preserved. Tunarr will not scan it until the server reports it again.`}
    >
      <Chip
        size="small"
        color="warning"
        variant="outlined"
        label={t`Unavailable`}
        sx={{ mx: 1 }}
      />
    </Tooltip>
  );
};
