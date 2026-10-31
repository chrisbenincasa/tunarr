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

// Only an error blocks setup. The check warns when it cannot parse the version
// string, which includes git builds that work fine. A missing check means the
// server has not reported one.
export const isFfmpegOk = (check: HealthCheck | undefined) =>
  check?.type !== 'error';

// Container images bundle FFmpeg, so the step only shows there when the check
// reports a warning or an error.
export const showFfmpegStep = (
  isInContainer: boolean,
  check: HealthCheck | undefined,
) => !isInContainer || check?.type === 'warning' || check?.type === 'error';
