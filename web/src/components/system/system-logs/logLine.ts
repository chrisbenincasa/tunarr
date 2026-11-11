import { isNumber, isString } from 'lodash-es';

// Most to least severe. The level filter lists them in this order.
export const LogLevels = [
  'fatal',
  'error',
  'warn',
  'info',
  'http',
  'debug',
  'trace',
] as const;

export type LogLevel = (typeof LogLevels)[number];

export type LogError = {
  type?: string;
  message?: string;
  stack?: string;
};

export type LogLine = {
  // Counts up as lines arrive, so it keys rows across buffer updates.
  id: number;
  time: number;
  level: LogLevel;
  caller?: string;
  msg: string;
  err?: LogError;

  // Every other field on the line, such as task or worker.
  context: Record<string, unknown>;
  raw: string;
};

// pino's numeric levels, plus Tunarr's custom http level.
export const logLevelFromNumber = (level: number): LogLevel | undefined => {
  switch (level) {
    case 10:
      return 'trace';
    case 20:
      return 'debug';
    case 25:
      return 'http';
    case 30:
      return 'info';
    case 40:
      return 'warn';
    case 50:
      return 'error';
    case 60:
      return 'fatal';
    default:
      return;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const optionalString = (value: unknown) =>
  isString(value) ? value : undefined;

const parseError = (value: unknown): LogError | undefined => {
  if (!isRecord(value)) {
    return;
  }
  return {
    type: optionalString(value.type),
    message: optionalString(value.message),
    stack: optionalString(value.stack),
  };
};

// Fields every line carries, or that LogLine already holds.
const knownFields = new Set([
  'level',
  'time',
  'msg',
  'caller',
  'err',
  'pid',
  'hostname',
]);

// Returns nothing for a line that is not a pino JSON object with a known level.
export const parseLogLine = (raw: string, id: number): LogLine | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!isRecord(parsed) || !isNumber(parsed.level) || !isNumber(parsed.time)) {
    return;
  }

  const level = logLevelFromNumber(parsed.level);
  if (!level) {
    return;
  }

  const err = parseError(parsed.err);
  const context = Object.fromEntries(
    Object.entries(parsed).filter(([key]) => !knownFields.has(key)),
  );

  return {
    id,
    time: parsed.time,
    level,
    caller: optionalString(parsed.caller),
    msg: optionalString(parsed.msg) ?? err?.message ?? '',
    err,
    context,
    raw,
  };
};

// Shows a context value as text. Objects and arrays print as JSON.
export const formatContextValue = (value: unknown) =>
  isString(value) ? value : JSON.stringify(value);
