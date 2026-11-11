import { describe, expect, test } from 'vitest';
import {
  formatContextValue,
  logLevelFromNumber,
  parseLogLine,
} from './logLine.ts';

const raw = (fields: Record<string, unknown>) =>
  JSON.stringify({
    level: 30,
    time: 1_700_000_000_000,
    pid: 42,
    hostname: 'tunarr',
    msg: 'Server started',
    ...fields,
  });

describe('logLevelFromNumber', () => {
  test.each([
    [10, 'trace'],
    [20, 'debug'],
    [25, 'http'],
    [30, 'info'],
    [40, 'warn'],
    [50, 'error'],
    [60, 'fatal'],
  ])('maps %i to %s', (level, name) => {
    expect(logLevelFromNumber(level)).toBe(name);
  });

  test('returns nothing for an unknown level', () => {
    expect(logLevelFromNumber(35)).toBeUndefined();
  });
});

describe('parseLogLine', () => {
  test('reads the core fields and keeps the raw text', () => {
    const text = raw({ caller: 'Scanner' });
    expect(parseLogLine(text, 7)).toEqual({
      id: 7,
      time: 1_700_000_000_000,
      level: 'info',
      caller: 'Scanner',
      msg: 'Server started',
      err: undefined,
      context: {},
      raw: text,
    });
  });

  test('keeps extra fields as context, without pid and hostname', () => {
    const line = parseLogLine(
      raw({ task: 'ScanLibrariesTask', worker: true, req: { id: 3 } }),
      0,
    );
    expect(line?.context).toEqual({
      task: 'ScanLibrariesTask',
      worker: true,
      req: { id: 3 },
    });
  });

  test('reads a serialized error', () => {
    const line = parseLogLine(
      raw({
        level: 50,
        msg: 'Scan failed',
        err: {
          type: 'AxiosError',
          message: 'connect ECONNREFUSED',
          stack: 'AxiosError: connect ECONNREFUSED\n    at doRequest',
        },
      }),
      0,
    );
    expect(line?.level).toBe('error');
    expect(line?.err).toEqual({
      type: 'AxiosError',
      message: 'connect ECONNREFUSED',
      stack: 'AxiosError: connect ECONNREFUSED\n    at doRequest',
    });
    expect(line?.context).toEqual({});
  });

  test("falls back to the error's message when the line has none", () => {
    const line = parseLogLine(
      raw({ msg: undefined, err: { message: 'Disk full' } }),
      0,
    );
    expect(line?.msg).toBe('Disk full');
  });

  test.each([
    ['text that is not JSON', 'not json'],
    ['a JSON array', '[1, 2]'],
    ['an unknown level', raw({ level: 99 })],
    ['a missing time', raw({ time: undefined })],
  ])('drops %s', (_, text) => {
    expect(parseLogLine(text, 0)).toBeUndefined();
  });
});

describe('formatContextValue', () => {
  test('prints strings as they are and other values as JSON', () => {
    expect(formatContextValue('Movies')).toBe('Movies');
    expect(formatContextValue(true)).toBe('true');
    expect(formatContextValue({ id: 3 })).toBe('{"id":3}');
  });
});
