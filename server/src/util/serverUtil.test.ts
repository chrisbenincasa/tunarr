import { describe, expect, test } from 'vitest';
import { boundInterfaceHost } from './serverUtil.ts';

describe('boundInterfaceHost', () => {
  test('is unset when Tunarr listens on every interface', () => {
    for (const wildcard of ['0.0.0.0', '::', '[::]', '*', ' ', '']) {
      expect(boundInterfaceHost(wildcard)).toBeUndefined();
    }
  });

  test('follows a bind address naming one interface', () => {
    expect(boundInterfaceHost('192.168.1.10')).toBe('192.168.1.10');
  });

  test('brackets an IPv6 literal so it can sit in a URL', () => {
    expect(boundInterfaceHost('fd00::1')).toBe('[fd00::1]');
    expect(boundInterfaceHost('[fd00::1]')).toBe('[fd00::1]');
  });
});
