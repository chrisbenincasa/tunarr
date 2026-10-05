import { useLingui } from '@lingui/react/macro';
import { WarningAmber } from '@mui/icons-material';
import { Chip, Tooltip } from '@mui/material';
import type { ReactElement } from 'react';
import { useDayjs } from '../hooks/useDayjs.ts';

type Props = {
  unavailableSince: number;
};

const UnavailableTooltip = ({
  unavailableSince,
  children,
}: Props & { children: ReactElement }) => {
  const { t } = useLingui();
  const dayjs = useDayjs();
  const since = dayjs(unavailableSince).format('LLL');

  return (
    <Tooltip
      placement="top"
      title={t`The media server stopped reporting this library on ${since}. Its programs and channel schedules are preserved. Tunarr will not scan it until the server reports it again.`}
    >
      {children}
    </Tooltip>
  );
};

export const UnavailableLibraryChip = ({ unavailableSince }: Props) => {
  const { t } = useLingui();

  return (
    <UnavailableTooltip unavailableSince={unavailableSince}>
      <Chip
        size="small"
        color="warning"
        variant="outlined"
        label={t`Unavailable`}
      />
    </UnavailableTooltip>
  );
};

// Used where a chip would wrap onto its own line, such as the library table.
export const UnavailableLibraryIcon = ({ unavailableSince }: Props) => {
  const { t } = useLingui();

  return (
    <UnavailableTooltip unavailableSince={unavailableSince}>
      <WarningAmber
        color="warning"
        fontSize="small"
        aria-label={t`Unavailable`}
        sx={{ flexShrink: 0 }}
      />
    </UnavailableTooltip>
  );
};
