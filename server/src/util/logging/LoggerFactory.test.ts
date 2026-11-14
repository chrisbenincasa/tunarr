import { symbols } from 'pino';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  lowestClassLogLevelOverride,
  resolveBaseLogLevel,
  resolveLogFileMode,
} from './LoggerFactory.ts';

/**
 * Regression for #2193 — every worker thread built its own rolling
 * destination, so all of them rolled the shared tunarr.log at the same cron
 * tick and raced on the same files.
 */
describe('resolveLogFileMode (#2193)', () => {
  it('rolls on the main thread when rolling is enabled', () => {
    expect(resolveLogFileMode({ rollEnabled: true, isMainThread: true })).toBe(
      'rolling',
    );
  });

  it('appends on a worker thread even when rolling is enabled', () => {
    expect(resolveLogFileMode({ rollEnabled: true, isMainThread: false })).toBe(
      'append',
    );
  });

  it('appends on every thread when rolling is disabled', () => {
    expect(resolveLogFileMode({ rollEnabled: false, isMainThread: true })).toBe(
      'append',
    );
    expect(
      resolveLogFileMode({ rollEnabled: false, isMainThread: false }),
    ).toBe('append');
  });
});

/**
 * Regression for #1992 — `--log_level`/`-v` had no effect on the running
 * server: the CLI flags were resolved into `globalOptions().log_level` by
 * `setGlobalOptionsUnchecked` but the logger only consulted settings/env and
 * never honored it. The base level resolution now gives explicit CLI flags
 * top priority, falling back to env (when enabled) then settings.
 */
describe('resolveBaseLogLevel (#1992)', () => {
  it('honors an explicit --log_level flag over env and settings', () => {
    expect(
      resolveBaseLogLevel({
        cliLogLevel: 'debug',
        envLogLevel: 'warn',
        useEnvVarLevel: true,
        settingsLogLevel: 'error',
      }),
    ).toEqual({ source: 'cli', level: 'debug' });
  });

  it('honors -v/--verbose (as debug) when log_level is not set', () => {
    // verbose resolves to 'debug' in setGlobalOptionsUnchecked, so it arrives
    // here as cliLogLevel === 'debug'.
    expect(
      resolveBaseLogLevel({
        cliLogLevel: 'debug',
        envLogLevel: undefined,
        useEnvVarLevel: true,
        settingsLogLevel: 'info',
      }),
    ).toEqual({ source: 'cli', level: 'debug' });
  });

  it('does not clobber settings when no flag was passed and env is off', () => {
    // yargs default is now undefined, so the flag "not passed" is a real
    // signal: with useEnvVarLevel off, the saved settings level must win.
    expect(
      resolveBaseLogLevel({
        cliLogLevel: undefined,
        envLogLevel: 'debug',
        useEnvVarLevel: false,
        settingsLogLevel: 'info',
      }),
    ).toEqual({ source: 'settings', level: 'info' });
  });

  it('falls back to env when enabled and no CLI flag was passed', () => {
    expect(
      resolveBaseLogLevel({
        cliLogLevel: undefined,
        envLogLevel: 'trace',
        useEnvVarLevel: true,
        settingsLogLevel: 'info',
      }),
    ).toEqual({ source: 'env', level: 'trace' });
  });
});

describe('lowestClassLogLevelOverride', () => {
  it('returns the finest per-class level and ignores the global var', () => {
    expect(
      lowestClassLogLevelOverride({
        TUNARR_LOG_LEVEL: 'trace',
        TUNARR_LOG_LEVEL_SCANNER: 'debug',
        TUNARR_LOG_LEVEL_HTTPCLIENT: 'http_out',
        OTHER: 'trace',
      }),
    ).toBe('http_out');
  });

  it('returns undefined when no class override is set', () => {
    expect(lowestClassLogLevelOverride({ TUNARR_LOG_LEVEL: 'debug' })).toBe(
      undefined,
    );
  });
});

describe('LoggerFactory class level overrides', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function importWithOverride() {
    vi.stubEnv('TUNARR_LOG_LEVEL_OVERRIDETEST', 'trace');
    vi.resetModules();
    const { LoggerFactory } = await import('./LoggerFactory.ts');
    return LoggerFactory;
  }

  it('opens the shared streams at the override level', async () => {
    const factory = await importWithOverride();
    const shared = factory.root[symbols.streamSym] as unknown as {
      streams: { level: number }[];
    };

    expect(shared.streams.map((s) => s.level)).toEqual([10]);
    expect(factory.child({ className: 'OverrideTest' }).level).toBe('trace');
  });

  it('reuses the shared streams on every child call', async () => {
    const factory = await importWithOverride();
    const shared = factory.root[symbols.streamSym] as unknown as {
      streams: { stream: unknown }[];
    };
    const streamsBefore = shared.streams;
    const firstStream = streamsBefore[0]?.stream;

    factory.child({ className: 'OverrideTest' });
    factory.child({ className: 'OverrideTest' });

    expect(shared.streams).toBe(streamsBefore);
    expect(shared.streams[0]?.stream).toBe(firstStream);
  });
});
