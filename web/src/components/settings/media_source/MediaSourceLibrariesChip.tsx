import { useLingui } from '@lingui/react/macro';
import { Warning } from '@mui/icons-material';
import { Chip, Tooltip } from '@mui/material';
import type { MediaSourceSettings } from '@tunarr/types';

type Props = {
  mediaSource: MediaSourceSettings;
  onClick: () => void;
};

// Local sources sync every folder they were created with, so they have
// nothing to choose and show no chip.
export const MediaSourceLibrariesChip = ({ mediaSource, onClick }: Props) => {
  const { t } = useLingui();

  if (mediaSource.type === 'local') {
    return '-';
  }

  const total = mediaSource.libraries.length;
  const enabled = mediaSource.libraries.filter((lib) => lib.enabled).length;
  const noneEnabled = enabled === 0;

  return (
    <Tooltip
      placement="top"
      title={t`Tunarr only syncs content from enabled libraries. Click to choose libraries.`}
    >
      <Chip
        size="small"
        clickable
        color={noneEnabled ? 'warning' : 'default'}
        variant={noneEnabled ? 'filled' : 'outlined'}
        icon={noneEnabled ? <Warning /> : undefined}
        label={
          noneEnabled
            ? t`No libraries enabled`
            : t`${enabled} of ${total} enabled`
        }
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      />
    </Tooltip>
  );
};
