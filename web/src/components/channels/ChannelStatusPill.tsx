import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { ButtonBase } from '@mui/material';
import { StatusPill } from '../ui/StatusPill.tsx';
import type { ChannelStatus } from './channelSummary.ts';

type Props = {
  status: ChannelStatus;

  // Opens the session list. The pill is a button only while sessions exist.
  onOpenSessions?: () => void;
};

export const ChannelStatusPill = ({ status, onOpenSessions }: Props) => {
  const { t } = useLingui();

  const label =
    status.status === 'live'
      ? plural(status.connections, { one: '# watching', other: '# watching' })
      : status.status === 'warning'
        ? t`No viewers`
        : t`Idle`;

  const pill = <StatusPill status={status.status} label={label} />;

  if (status.sessions === 0 || !onOpenSessions) {
    return pill;
  }

  return (
    <ButtonBase
      aria-label={t`${label}, show sessions`}
      onClick={(e) => {
        e.stopPropagation();
        onOpenSessions();
      }}
      sx={{ borderRadius: 999 }}
    >
      {pill}
    </ButtonBase>
  );
};
