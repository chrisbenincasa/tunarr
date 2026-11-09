import { Trans } from '@lingui/react/macro';
import type { Task } from '@tunarr/types';
import { StatusPill } from '../../ui/StatusPill.tsx';
import { taskStatus } from './taskSchedule.ts';

export const TaskStatusPill = ({ task }: { task: Task }) => {
  const status = taskStatus(task);
  switch (status) {
    case 'running':
      return <StatusPill status="live" label={<Trans>Running</Trans>} />;
    case 'scheduled':
      return <StatusPill status="idle" label={<Trans>Scheduled</Trans>} />;
    case 'manual':
      return <StatusPill status="idle" label={<Trans>Manual only</Trans>} />;
  }
};
