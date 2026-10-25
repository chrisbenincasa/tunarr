import type { StatusPillStatus } from '@/components/ui/StatusPill.tsx';
import type { RolePreview } from '@/hooks/useAutoChannel.ts';

export type RolePreviewStatus = {
  status: StatusPillStatus;
  label: string;
};

export function rolePreviewStatus(
  preview: RolePreview | undefined,
  minPrograms: number,
): RolePreviewStatus {
  if (preview === undefined || preview.awaitingInput) {
    return { status: 'idle', label: 'Needs a selection' };
  }

  if (preview.error !== null) {
    return { status: 'error', label: 'Preview failed' };
  }

  if (preview.isLoading || preview.data === undefined) {
    return { status: 'idle', label: 'Counting' };
  }

  const total = preview.data.totalPrograms;
  if (total === 0) {
    return { status: 'error', label: 'No matches' };
  }

  const label = `${total.toLocaleString()} program${total === 1 ? '' : 's'}`;
  return { status: total < minPrograms ? 'warning' : 'live', label };
}
