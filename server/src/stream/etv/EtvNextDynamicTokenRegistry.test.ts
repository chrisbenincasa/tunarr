import { describe, expect, test } from 'vitest';
import {
  EtvNextDynamicTokenRegistry,
  parseBearerToken,
} from './EtvNextDynamicTokenRegistry.ts';

describe('issuing', () => {
  test('a token resolves to the channel it was issued for', () => {
    const registry = new EtvNextDynamicTokenRegistry();
    const token = registry.issue('chan-1', 7);

    expect(registry.resolve(token)).toEqual({
      channelUuid: 'chan-1',
      channelNumber: 7,
    });
  });

  test('two channels never share a token', () => {
    const registry = new EtvNextDynamicTokenRegistry();
    const first = registry.issue('chan-1', 7);
    const second = registry.issue('chan-2', 8);

    expect(first).not.toBe(second);
    expect(registry.resolve(second)?.channelUuid).toBe('chan-2');
  });

  test('restarting a channel invalidates its old token', () => {
    const registry = new EtvNextDynamicTokenRegistry();
    const first = registry.issue('chan-1', 7);
    registry.issue('chan-1', 7);

    expect(registry.resolve(first)).toBeUndefined();
    expect(registry.size).toBe(1);
  });
});

describe('rejecting', () => {
  test('nothing resolves without a token', () => {
    const registry = new EtvNextDynamicTokenRegistry();
    registry.issue('chan-1', 7);

    expect(registry.resolve(undefined)).toBeUndefined();
    expect(registry.resolve('')).toBeUndefined();
  });

  test('a token no session holds resolves to nothing', () => {
    const registry = new EtvNextDynamicTokenRegistry();
    registry.issue('chan-1', 7);

    expect(registry.resolve('not-a-real-token')).toBeUndefined();
  });

  // The token dies with the session, so a worker that outlived its kill
  // cannot keep resolving items.
  test('a revoked token stops working', () => {
    const registry = new EtvNextDynamicTokenRegistry();
    const token = registry.issue('chan-1', 7);

    registry.revoke('chan-1');

    expect(registry.resolve(token)).toBeUndefined();
    expect(registry.size).toBe(0);
  });
});

describe('parseBearerToken', () => {
  test('reads the credential out of a bearer header', () => {
    expect(parseBearerToken('Bearer abc123')).toBe('abc123');
    expect(parseBearerToken('bearer abc123')).toBe('abc123');
  });

  test('ignores anything that is not a bearer credential', () => {
    expect(parseBearerToken(undefined)).toBeUndefined();
    expect(parseBearerToken('Basic abc123')).toBeUndefined();
    expect(parseBearerToken('Bearer ')).toBeUndefined();
  });
});
