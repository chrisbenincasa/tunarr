import { describe, expect, test } from 'vitest';
import {
  createDynamicPlaceholder,
  DynamicResolverPath,
  DynamicRollThresholdMs,
  DynamicTokenEnvVar,
  DynamicWindowMs,
  dynamicPlaceholderId,
  dynamicResolverHost,
  dynamicResolverUri,
} from './EtvNextDynamicPlayout.ts';
import { PlayoutItemSchema } from './generated/playout.ts';

const channelUuid = 'chan-1';
const startMs = Date.parse('2026-02-23T20:00:00.000-05:00');

const placeholder = (start = startMs, finish = startMs + DynamicWindowMs) =>
  createDynamicPlaceholder({
    channelUuid,
    startMs: start,
    finishMs: finish,
    resolverUri: dynamicResolverUri(8000, undefined),
  });

describe('the dynamic placeholder', () => {
  test('points the worker at the resolver over loopback', () => {
    expect(placeholder().source).toMatchObject({
      source_type: 'dynamic',
      uri: `http://127.0.0.1:8000${DynamicResolverPath}`,
    });
  });

  // The worker expands the template from its own environment, so the secret
  // never lands in a file.
  test('carries the token as a template rather than a value', () => {
    const { source } = placeholder();

    expect(source).toMatchObject({
      headers: [`Authorization: Bearer {{${DynamicTokenEnvVar}}}`],
    });
  });

  test('bounds the window it was asked for', () => {
    const item = placeholder();

    expect(Date.parse(item.start)).toBe(startMs);
    expect(Date.parse(item.finish)).toBe(startMs + DynamicWindowMs);
  });

  // A changed id reads upstream as a different item and restarts playback.
  test('keeps one id per channel across rolls', () => {
    expect(placeholder().id).toBe(placeholder(startMs + 1000).id);
    expect(placeholder().id).toBe(dynamicPlaceholderId(channelUuid));
  });

  test('strict-parses against the playout schema', () => {
    expect(
      PlayoutItemSchema.safeParse(placeholder()).error?.issues,
    ).toBeUndefined();
  });
});

// Tunarr binds TUNARR_BIND_ADDR, so loopback is only reachable when that is a
// wildcard. Upstream answers a refused callback with black video and no log.
describe('the resolver host', () => {
  test('is loopback when Tunarr listens on every interface', () => {
    for (const wildcard of ['0.0.0.0', '::', '[::]', '*', ' ']) {
      expect(dynamicResolverHost(wildcard)).toBe('127.0.0.1');
    }
  });

  test('is loopback when no bind address is set', () => {
    expect(dynamicResolverHost(undefined)).toBe('127.0.0.1');
    expect(dynamicResolverHost('')).toBe('127.0.0.1');
  });

  test('follows a bind address naming one interface', () => {
    expect(dynamicResolverHost('192.168.1.10')).toBe('192.168.1.10');
    expect(dynamicResolverUri(8000, '192.168.1.10')).toBe(
      `http://192.168.1.10:8000${DynamicResolverPath}`,
    );
  });

  test('brackets an IPv6 literal so it can sit in a URL', () => {
    expect(dynamicResolverHost('fd00::1')).toBe('[fd00::1]');
    expect(dynamicResolverHost('[fd00::1]')).toBe('[fd00::1]');
    expect(dynamicResolverUri(8000, '::1')).toBe(
      `http://[::1]:8000${DynamicResolverPath}`,
    );
  });

  test('reads the bind address from the environment by default', () => {
    const previous = process.env.TUNARR_BIND_ADDR;
    process.env.TUNARR_BIND_ADDR = '10.0.0.5';

    try {
      expect(dynamicResolverUri(8000)).toBe(
        `http://10.0.0.5:8000${DynamicResolverPath}`,
      );
    } finally {
      if (previous === undefined) {
        delete process.env.TUNARR_BIND_ADDR;
      } else {
        process.env.TUNARR_BIND_ADDR = previous;
      }
    }
  });
});

describe('window depth', () => {
  // The worker clamps every resolved item's finish to the placeholder's, so a
  // shallow window truncates long programs.
  test('leaves the whole roll threshold to recover in', () => {
    expect(DynamicWindowMs).toBeGreaterThan(DynamicRollThresholdMs * 2);
  });
});
