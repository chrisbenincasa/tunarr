import { describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import {
  BlockedOutboundUrlError,
  checkOutboundUrl,
  classifyUpstreamError,
  isBlockedOutboundUrlError,
  outboundRedirectGuard,
  outboundRequestGuard,
} from './outboundRequests.ts';

vi.mock('node:dns/promises', () => ({
  default: {
    lookup: vi.fn(async (hostname: string) => {
      if (hostname === 'rebind.example') {
        return [{ address: '169.254.169.254', family: 4 }];
      }
      if (hostname === 'jellyfin.lan') {
        return [{ address: '192.168.1.50', family: 4 }];
      }
      // Resolves to loopback so the allow-path test gets an instant
      // ECONNREFUSED instead of touching the real network.
      if (hostname === 'loopback.example') {
        return [{ address: '127.0.0.1', family: 4 }];
      }
      throw new Error('ENOTFOUND');
    }),
  },
}));

describe('checkOutboundUrl', () => {
  describe('blocks cloud metadata endpoints', () => {
    it.each([
      'http://169.254.169.254/latest/meta-data?x=',
      'http://169.254.169.254',
      'https://169.254.0.1',
      'http://[fd00:ec2::254]',
      'http://[fe80::1]',
      'http://[::ffff:169.254.169.254]',
      'http://metadata.google.internal',
    ])('blocks %s', async (url) => {
      await expect(checkOutboundUrl(url)).resolves.toBe('blocked-address');
    });

    it('blocks a hostname that resolves to a metadata address', async () => {
      await expect(checkOutboundUrl('http://rebind.example')).resolves.toBe(
        'blocked-address',
      );
    });
  });

  describe('allows the addresses Tunarr actually needs', () => {
    // Tunarr exists to reach media servers on the user's own network. If these
    // ever start failing, the guard has been "hardened" into breaking the product.
    it.each([
      'http://192.168.1.50:8096',
      'http://10.0.0.5:32400',
      'http://172.16.4.4:8096',
      'http://127.0.0.1:8096',
      'http://localhost:8096',
      'http://[::1]:8096',
      'https://plex.example.com:32400',
      'http://jellyfin.lan:8096',
    ])('allows %s', async (url) => {
      await expect(checkOutboundUrl(url)).resolves.toBeUndefined();
    });

    it('allows a name that does not resolve, so the request reports normally', async () => {
      await expect(
        checkOutboundUrl('http://nonexistent.invalid'),
      ).resolves.toBeUndefined();
    });
  });

  describe('rejects malformed input', () => {
    it('rejects a non-URL', async () => {
      await expect(checkOutboundUrl('not a url')).resolves.toBe('invalid-url');
    });

    it.each(['file:///etc/passwd', 'gopher://169.254.169.254'])(
      'rejects the non-http protocol in %s',
      async (url) => {
        await expect(checkOutboundUrl(url)).resolves.toBe(
          'unsupported-protocol',
        );
      },
    );
  });
});

describe('outboundRedirectGuard', () => {
  const { beforeRedirect, maxRedirects } = outboundRedirectGuard;

  it('caps the redirect chain', () => {
    expect(maxRedirects).toBeLessThanOrEqual(3);
  });

  it.each([
    '169.254.169.254',
    '169.254.0.1',
    'fd00:ec2::254',
    'fe80::1',
    '::ffff:a9fe:a9fe',
    'metadata.google.internal',
  ])('rejects a redirect to %s', (hostname) => {
    expect(() => beforeRedirect({ hostname, protocol: 'http:' })).toThrow(
      BlockedOutboundUrlError,
    );
  });

  it('rejects a redirect to a non-http protocol', () => {
    expect(() =>
      beforeRedirect({ hostname: 'example.com', protocol: 'file:' }),
    ).toThrow(BlockedOutboundUrlError);
  });

  it.each(['192.168.1.50', '127.0.0.1', '10.0.0.5', 'plex.example.com'])(
    'allows a redirect to %s',
    (hostname) => {
      expect(() =>
        beforeRedirect({ hostname, protocol: 'https:' }),
      ).not.toThrow();
    },
  );
});

describe('outboundRequestGuard agent lookup', () => {
  // The unit tests above cover the pieces. This drives a real axios request
  // through the agent, which is the only way to confirm the lookup is actually
  // wired in and that the refusal survives axios's error wrapping.
  it('refuses a connection to a host that resolves into a blocked range', async () => {
    const error = await axios
      .get('http://rebind.example/whatever', {
        ...outboundRequestGuard,
        timeout: 5000,
      })
      .then(() => undefined)
      .catch((e: unknown) => e);

    expect(error).toBeDefined();
    expect(isBlockedOutboundUrlError(error)).toBe(true);
  });

  // Regression: Node skips DNS when the host is already an IP literal, so
  // guardedLookup is never called for one. Before the createConnection guard
  // this request connected and hung until timeout instead of being refused.
  it('refuses a request straight to a blocked IP literal', async () => {
    const error = await axios
      .get('http://169.254.169.254/latest/meta-data', {
        ...outboundRequestGuard,
        timeout: 3000,
      })
      .then(() => undefined)
      .catch((e: unknown) => e);

    expect(error).toBeDefined();
    expect(isBlockedOutboundUrlError(error)).toBe(true);
  });

  it('refuses a blocked IPv6 literal', async () => {
    const error = await axios
      .get('http://[fd00:ec2::254]/latest/meta-data', {
        ...outboundRequestGuard,
        timeout: 3000,
      })
      .then(() => undefined)
      .catch((e: unknown) => e);

    expect(error).toBeDefined();
    expect(isBlockedOutboundUrlError(error)).toBe(true);
  });

  it('does not refuse a host that resolves to a private address', async () => {
    // Connection is refused because nothing is listening, but it must not be
    // refused by policy - that is the case we deliberately allow.
    const error = await axios
      .get('http://loopback.example:1/whatever', {
        ...outboundRequestGuard,
        timeout: 5000,
      })
      .then(() => undefined)
      .catch((e: unknown) => e);

    // It still fails - nothing is listening - but not by policy, which is the
    // distinction that matters.
    expect(error).toBeDefined();
    expect(isBlockedOutboundUrlError(error)).toBe(false);
  });
});

describe('isBlockedOutboundUrlError', () => {
  it('finds our error underneath an axios wrapper', () => {
    const wrapped = new Error('connect failed', {
      cause: new BlockedOutboundUrlError('blocked-address'),
    });

    expect(isBlockedOutboundUrlError(wrapped)).toBe(true);
  });

  it('does not claim an ordinary connection failure', () => {
    expect(
      isBlockedOutboundUrlError(
        new Error('connect ECONNREFUSED 10.0.0.5:6379'),
      ),
    ).toBe(false);
  });

  it('terminates on a cyclic cause chain', () => {
    const a: { cause?: unknown } = new Error('a');
    const b: { cause?: unknown } = new Error('b');
    a.cause = b;
    b.cause = a;

    expect(isBlockedOutboundUrlError(a)).toBe(false);
  });
});

describe('classifyUpstreamError', () => {
  function axiosError(extra: Record<string, unknown>) {
    return { isAxiosError: true, ...extra };
  }

  it('reports a connection failure as unreachable without the errno', () => {
    expect(
      classifyUpstreamError(
        axiosError({
          code: 'ECONNREFUSED',
          message: 'connect ECONNREFUSED 10.0.0.5:6379',
        }),
      ),
    ).toBe('unreachable');
  });

  it('reports a timeout', () => {
    expect(classifyUpstreamError(axiosError({ code: 'ETIMEDOUT' }))).toBe(
      'timeout',
    );
  });

  it.each([401, 403])('reports %i as auth', (status) => {
    expect(classifyUpstreamError(axiosError({ response: { status } }))).toBe(
      'auth',
    );
  });

  it('reports another HTTP status as bad_response', () => {
    expect(
      classifyUpstreamError(axiosError({ response: { status: 404 } })),
    ).toBe('bad_response');
  });

  it('reports a non-axios error as unknown', () => {
    expect(classifyUpstreamError(new Error('boom'))).toBe('unknown');
  });
});
