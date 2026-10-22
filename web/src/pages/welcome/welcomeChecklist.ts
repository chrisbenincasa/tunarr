import type { HealthCheck, MediaSourceType } from '@tunarr/types';

type ChecklistSource = {
  type: MediaSourceType;
  libraries: { enabled: boolean; lastScannedAt?: number }[];
};

// Local sources sync every library they have.
export const syncedLibraries = <Source extends ChecklistSource>(
  sources: Source[],
): Source['libraries'] =>
  sources.flatMap((source) =>
    source.libraries.filter((lib) => source.type === 'local' || lib.enabled),
  );

export const hasScannedLibrary = (sources: ChecklistSource[] | undefined) =>
  syncedLibraries(sources ?? []).some((lib) => lib.lastScannedAt !== undefined);

// A missing check means the server has not reported one, so it does not block setup.
export const isFfmpegOk = (check: HealthCheck | undefined) =>
  check === undefined || check.type === 'healthy' || check.type === 'info';

// Container images bundle FFmpeg, so the step only shows there when the check fails.
export const showFfmpegStep = (
  isInContainer: boolean,
  check: HealthCheck | undefined,
) => !isInContainer || !isFfmpegOk(check);
