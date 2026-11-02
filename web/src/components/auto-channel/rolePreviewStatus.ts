import type { StatusPillStatus } from '@/components/ui/StatusPill.tsx';
import type { RolePreview } from '@/hooks/useAutoChannel.ts';
import type { ContentRequirement } from '@tunarr/types/api';

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

/**
 * Whether every role has a settled preview with enough programs. A role with
 * no matches would leave its slots empty, so it blocks creation even when its
 * minimum is zero.
 */
export function canCreateChannel(
  roles: Pick<ContentRequirement, 'role' | 'minPrograms'>[],
  previews: Record<string, RolePreview>,
): boolean {
  return (
    roles.length > 0 &&
    roles.every((req) => {
      const preview = previews[req.role];
      if (!preview || preview.awaitingInput || preview.error !== null) {
        return false;
      }
      const total = preview.data?.totalPrograms ?? 0;
      return total > 0 && total >= req.minPrograms;
    })
  );
}
