export type TimeBlock = {
  role: string;
  label: string;
  startTime: number; // ms offset from midnight
};

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MAX_START_TIME = 23 * MS_PER_HOUR + 59 * MS_PER_MINUTE;

/**
 * A start time for a new block. It aims three hours after the latest block
 * and walks back a minute at a time until no other block starts then.
 */
export function nextFreeStartTime(blocks: TimeBlock[]): number {
  if (blocks.length === 0) {
    return 0;
  }

  const taken = new Set(blocks.map((b) => b.startTime));
  const latest = Math.max(...blocks.map((b) => b.startTime));
  const target = Math.min(latest + 3 * MS_PER_HOUR, MAX_START_TIME);

  for (let t = target; t >= 0; t -= MS_PER_MINUTE) {
    if (!taken.has(t)) {
      return t;
    }
  }
  return target;
}

/**
 * Roles of blocks that share a start time with another block. The time slot
 * scheduler keeps only one slot per start time, so these would never air.
 */
export function duplicateStartTimeRoles(blocks: TimeBlock[]): Set<string> {
  const counts = new Map<number, number>();
  for (const block of blocks) {
    counts.set(block.startTime, (counts.get(block.startTime) ?? 0) + 1);
  }
  return new Set(
    blocks.filter((b) => (counts.get(b.startTime) ?? 0) > 1).map((b) => b.role),
  );
}
