import type { MidRollBreakRule, MidRollConfig } from '@tunarr/types/api';

export type BreakPoint = { offsetMs: number };

export function resolveBreakDuration(
  config: MidRollConfig,
  random?: { integer(min: number, max: number): number },
): number {
  if (
    config.breakDurationMinMs !== undefined &&
    config.breakDurationMaxMs !== undefined
  ) {
    if (!random) {
      return config.breakDurationMaxMs;
    }
    return random.integer(config.breakDurationMinMs, config.breakDurationMaxMs);
  }

  if (config.breakDurationMs === undefined) {
    throw new Error(
      'MidRollConfig must have either breakDurationMs or breakDurationMinMs/breakDurationMaxMs',
    );
  }

  return config.breakDurationMs;
}

export function resolveBreakPoints(
  programDurationMs: number,
  config: MidRollConfig,
): BreakPoint[] | null {
  if (programDurationMs < config.minProgramDurationMs) return null;

  let breakRule: MidRollBreakRule;
  if (config.breakRule) {
    breakRule = config.breakRule;
  } else if (config.intervalMs !== undefined) {
    breakRule = { type: 'fixed_interval', intervalMs: config.intervalMs };
  } else {
    throw new Error(
      'MidRollConfig must have either breakRule or intervalMs when enabled',
    );
  }

  let offsets: number[];

  switch (breakRule.type) {
    case 'fixed_interval': {
      offsets = [];
      let offset = breakRule.intervalMs;
      while (offset < programDurationMs) {
        offsets.push(offset);
        offset += breakRule.intervalMs;
      }
      break;
    }
    case 'percentage': {
      offsets = breakRule.points.map((p) =>
        Math.round((programDurationMs * p) / 100),
      );
      offsets.sort((a, b) => a - b);
      break;
    }
    case 'initial_then_interval': {
      offsets = [];
      let offset = breakRule.initialDelayMs;
      while (offset < programDurationMs) {
        offsets.push(offset);
        offset += breakRule.intervalMs;
      }
      break;
    }
  }

  // Use max of range for conservative filtering
  const breakDuration = resolveBreakDuration(config);
  const tailBuffer = config.tailBufferMs ?? 0;

  offsets = offsets.filter(
    (offset) => programDurationMs - offset - breakDuration >= tailBuffer,
  );

  if (config.maxBreaks > 0) {
    offsets = offsets.slice(0, config.maxBreaks);
  }

  if (offsets.length === 0) return null;

  return offsets.map((offsetMs) => ({ offsetMs }));
}
