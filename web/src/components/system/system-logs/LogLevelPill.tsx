import { StatusPill, type StatusPillStatus } from '../../ui/StatusPill.tsx';
import type { LogLevel } from './logLine.ts';

const pillStatus = (level: LogLevel): StatusPillStatus => {
  switch (level) {
    case 'fatal':
    case 'error':
      return 'error';
    case 'warn':
      return 'warning';
    case 'info':
    case 'http':
    case 'debug':
    case 'trace':
      return 'idle';
  }
};

// The label stays the raw level name, so it matches the level filter.
export const LogLevelPill = ({ level }: { level: LogLevel }) => (
  <StatusPill status={pillStatus(level)} label={level} />
);
