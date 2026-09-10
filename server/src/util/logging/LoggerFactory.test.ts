import { describe, expect, it } from 'vitest';
import { resolveBaseLogLevel } from './LoggerFactory.ts';

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