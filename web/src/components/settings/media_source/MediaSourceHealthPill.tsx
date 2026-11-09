import { Trans } from '@lingui/react/macro';
import { StatusPill } from '../../ui/StatusPill.tsx';

export type MediaSourceHealth = 'checking' | 'healthy' | 'unhealthy';

export const MediaSourceHealthPill = ({
  health,
}: {
  health: MediaSourceHealth;
}) => {
  switch (health) {
    case 'checking':
      return <StatusPill status="idle" label={<Trans>Checking</Trans>} />;
    case 'healthy':
      return <StatusPill status="live" label={<Trans>Healthy</Trans>} />;
    case 'unhealthy':
      return <StatusPill status="error" label={<Trans>Unreachable</Trans>} />;
  }
};
