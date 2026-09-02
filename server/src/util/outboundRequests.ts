import type { MediaSourceUnhealthyStatus } from '@tunarr/types/api';
import { isAxiosError } from 'axios';
import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net, { type LookupFunction } from 'node:net';

/**
 * Hostnames that resolve to cloud instance-metadata services.
 */
const BLOCKED_HOSTNAMES = new Set([
  'metadata.google.internal',
  'metadata.goog',
]);

export type OutboundUrlRejection =
  | 'invalid-url'
  | 'unsupported-protocol'
  | 'blocked-address';

export class BlockedOutboundUrlError extends Error {
  constructor(readonly rejection: OutboundUrlRejection) {
    super(`Refused to make an outbound request: ${rejection}`);
    this.name = 'BlockedOutboundUrlError';
  }
}

/**
 * 169.254.0.0/16. Link-local, and the home of every major cloud provider's
 * instance metadata service (169.254.169.254 on AWS, GCP, Azure, DigitalOcean
 * and Oracle).
 */
function isBlockedIpv4(address: string): boolean {
  const octets = address.split('.');
  if (octets.length !== 4) {
    return false;
  }

  return octets[0] === '169' && octets[1] === '254';
}

function isBlockedIpv6(address: string): boolean {
  // Strip any zone index, e.g. fe80::1%eth0
  const normalized = address.toLowerCase().split('%')[0] ?? '';

  // fe80::/10 - link-local
  if (/^fe[89ab]/.test(normalized)) {
    return true;
  }

  // fd00:ec2::/64 - the IPv6 endpoint for AWS instance metadata
  if (normalized.startsWith('fd00:ec2:')) {
    return true;
  }

  const mapped = mappedIpv4(normalized);
  if (mapped !== undefined) {
    return isBlockedIpv4(mapped);
  }

  return false;
}

/**
 * Extracts the IPv4 address from an IPv4-mapped IPv6 address, as a dotted quad.
 *
 * Both spellings have to be handled. WHATWG URL parsing normalizes
 * `::ffff:169.254.169.254` to the hex form `::ffff:a9fe:a9fe`, while dns.lookup
 * hands back the dotted form. Missing the hex form would let an attacker walk
 * straight past this guard.
 */
function mappedIpv4(normalized: string): string | undefined {
  const tail = /^::ffff:(.+)$/.exec(normalized)?.[1];
  if (tail === undefined) {
    return undefined;
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(tail)) {
    return tail;
  }

  const hextets = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(tail);
  const high = Number.parseInt(hextets?.[1] ?? '', 16);
  const low = Number.parseInt(hextets?.[2] ?? '', 16);
  if (Number.isNaN(high) || Number.isNaN(low)) {
    return undefined;
  }

  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}

function isBlockedAddress(address: string): boolean {
  switch (net.isIP(address)) {
    case 4:
      return isBlockedIpv4(address);
    case 6:
      return isBlockedIpv6(address);
    default:
      return false;
  }
}

/**
 * Checks whether Tunarr is willing to make an outbound request to a URL supplied
 * by an API caller. Returns the reason for refusal, or undefined if allowed.
 *
 * Only cloud instance-metadata addresses are refused. Those are never a media
 * server, so blocking them costs nothing.
 *
 * RFC 1918 private ranges, loopback and CGNAT are deliberately ALLOWED. Generic
 * SSRF advice says to block them, but Tunarr exists to talk to Plex, Jellyfin and
 * Emby servers on the user's own network - http://192.168.1.50:8096 and
 * http://localhost:8096 are the normal configuration, not an attack. Blocking
 * them would break the product for nearly every user. Do not "harden" this into
 * rejecting private addresses.
 *
 * On its own this is a check-then-fetch and so racy against DNS rebinding. It is
 * not relied on alone: outboundRequestGuard validates again inside the socket's
 * lookup, which is what actually closes that race. This exists to reject an
 * obviously bad destination up front, with a clear reason, before any connection
 * is attempted.
 */
export async function checkOutboundUrl(
  rawUrl: string,
): Promise<OutboundUrlRejection | undefined> {
  const parsed = URL.parse(rawUrl);
  if (!parsed) {
    return 'invalid-url';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'unsupported-protocol';
  }

  // URL.hostname keeps the brackets on an IPv6 literal
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return 'blocked-address';
  }

  if (net.isIP(hostname) !== 0) {
    return isBlockedAddress(hostname) ? 'blocked-address' : undefined;
  }

  // A name that does not resolve is not evidence of an attack. Let the request
  // itself fail so the caller gets the normal "unreachable" answer.
  const resolved = await dns
    .lookup(hostname, { all: true })
    .catch(() => undefined);

  if (!resolved) {
    return undefined;
  }

  return resolved.some((record) => isBlockedAddress(record.address))
    ? 'blocked-address'
    : undefined;
}

/**
 * Axios config that keeps the destination guard applied across redirects.
 *
 * checkOutboundUrl only vets the URL we are handed. Axios follows redirects (5
 * by default, and maxRedirects was previously unset), so a host the attacker
 * controls could answer with a 302 into a blocked range and slip past the
 * initial check entirely.
 *
 * Note the asymmetry: beforeRedirect is synchronous, so unlike checkOutboundUrl
 * it cannot resolve DNS. It catches a redirect to a blocked IP literal or to a
 * known metadata hostname, which is the realistic bypass. A redirect to some
 * other hostname that resolves into a blocked range is not caught here. Closing
 * that completely means validating in a custom agent `lookup`, which applies at
 * connect time on every hop.
 */
export const outboundRedirectGuard = {
  // These are health checks and logins against an API. A media server behind a
  // proxy may answer one redirect (http -> https, say), but it has no reason to
  // send us on a long chain.
  maxRedirects: 3,
  beforeRedirect: (options: { hostname?: string; protocol?: string }) => {
    if (
      options.protocol !== undefined &&
      options.protocol !== 'http:' &&
      options.protocol !== 'https:'
    ) {
      throw new BlockedOutboundUrlError('unsupported-protocol');
    }

    // follow-redirects has already stripped the brackets from an IPv6 hostname
    const hostname = options.hostname?.toLowerCase();
    if (
      hostname !== undefined &&
      (BLOCKED_HOSTNAMES.has(hostname) || isBlockedAddress(hostname))
    ) {
      throw new BlockedOutboundUrlError('blocked-address');
    }
  },
} as const;

/**
 * A dns.lookup replacement that refuses to hand a blocked address to a socket.
 *
 * This covers hostname resolution, and only that. checkOutboundUrl resolves the
 * name and then axios resolves it again independently, so the answer can change
 * in between; beforeRedirect is synchronous, so it can only inspect a redirect's
 * hostname, never what it resolves to. Validating inside lookup removes both:
 * there is a single resolution, and the addresses checked are the ones the socket
 * is given.
 *
 * It does NOT cover IP literals. Node skips DNS when the host is already an
 * address, so this is never called for one - guardAgentConnections handles that
 * case. No single layer here is sufficient on its own; see outboundRequestGuard
 * for how they divide the work.
 */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  void (async () => {
    try {
      const addresses = await dns.lookup(hostname, { ...options, all: true });

      if (addresses.some((record) => isBlockedAddress(record.address))) {
        callback(new BlockedOutboundUrlError('blocked-address'), '', 0);
        return;
      }

      if (options.all) {
        callback(null, addresses);
        return;
      }

      const first = addresses[0];
      if (!first) {
        callback(new Error(`No address found for ${hostname}`), '', 0);
        return;
      }

      callback(null, first.address, first.family);
    } catch (e) {
      callback(e as NodeJS.ErrnoException, '', 0);
    }
  })();
};

/**
 * Adds a literal-address check in front of an agent's connection creation.
 *
 * guardedLookup alone is not enough: Node skips DNS entirely when the host is
 * already an IP literal, so the lookup is never called and a request straight to
 * http://169.254.169.254/ would connect. createConnection runs either way, which
 * makes this the layer that covers literals.
 *
 * That matters beyond the request paths that call checkOutboundUrl first. A media
 * source can be persisted with an arbitrary uri and then fetched through the
 * unauthenticated scan and status routes, which reach BaseApiClient directly with
 * no up-front check. Guarding the connection covers those too.
 */
type ConnectionCallback = (err: Error | null, socket?: unknown) => void;

/**
 * `createConnection` exists on http.Agent and https.Agent at runtime but is not
 * declared on the type, so it has to be named here to wrap it.
 */
type AgentWithCreateConnection = {
  createConnection: (
    options: { host?: string },
    callback?: ConnectionCallback,
  ) => unknown;
};

function guardAgentConnections<T extends http.Agent>(agent: T): T {
  const target = agent as T & AgentWithCreateConnection;
  // bind() is untyped here (strictBindCallApply is off for this package), so the
  // bound function is narrowed back to the signature declared above.
  const createConnection = target.createConnection.bind(
    target,
  ) as AgentWithCreateConnection['createConnection'];

  target.createConnection = (
    options: { host?: string },
    callback?: ConnectionCallback,
  ) => {
    const host = options.host;
    if (host !== undefined && net.isIP(host) !== 0 && isBlockedAddress(host)) {
      const error = new BlockedOutboundUrlError('blocked-address');
      // Reported through the callback so it surfaces as a normal request error
      // rather than an exception thrown out of request construction.
      if (callback) {
        callback(error);
        return undefined;
      }
      throw error;
    }

    return createConnection(options, callback);
  };

  return agent;
}

/**
 * Axios config that applies the destination guard to a request and to every
 * redirect it follows.
 *
 * Four layers, none of which is sufficient alone. Together they cover every way
 * a destination can be reached:
 *
 * - checkOutboundUrl, called by the route before any connection, rejects a bad
 *   destination up front with a clear reason. Only covers callers that call it.
 * - guardAgentConnections catches IP literals, which never reach a DNS lookup.
 *   This is the layer that covers requests to a persisted media source uri.
 * - guardedLookup catches hostnames, validating what they resolve to rather than
 *   what they say.
 * - beforeRedirect rejects a redirect to a non-http protocol, which never opens
 *   a socket and so is invisible to the two agent layers, and maxRedirects caps
 *   the chain.
 *
 * Both agents are needed: axios hands follow-redirects an agent per protocol and
 * it re-selects on each hop, so an http -> https redirect would otherwise escape
 * the guard.
 */
export const outboundRequestGuard = {
  ...outboundRedirectGuard,
  httpAgent: guardAgentConnections(new http.Agent({ lookup: guardedLookup })),
  httpsAgent: guardAgentConnections(new https.Agent({ lookup: guardedLookup })),
} as const;

/**
 * Whether a failure was our own refusal rather than a genuine network problem.
 *
 * An error raised inside the agent lookup reaches the caller wrapped by axios,
 * with ours on `cause`. Without unwrapping it, a destination we deliberately
 * refused would be reported as "unreachable" and become indistinguishable from a
 * host that happens to be down.
 */
export function isBlockedOutboundUrlError(e: unknown): boolean {
  let current: unknown = e;

  // Bounded in case anything ever produces a cyclic cause chain
  for (
    let depth = 0;
    depth < 5 && current !== null && current !== undefined;
    depth++
  ) {
    if (current instanceof BlockedOutboundUrlError) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

export type UpstreamFailureReason = MediaSourceUnhealthyStatus['status'];

/**
 * Reduces an outbound request failure to a coarse reason.
 *
 * The API is unauthenticated, so anything we hand back about a failed outbound
 * request is available to an attacker probing the internal network. Raw axios
 * messages carry the errno, host and port ("connect ECONNREFUSED 10.0.0.5:6379"),
 * which turns these endpoints into a precise port scanner. Callers must return
 * this instead of the underlying error, and log the detail server-side.
 *
 * This cannot remove the signal entirely - an endpoint whose job is "can you
 * reach this server?" always answers that question. It removes the precision.
 */
export function classifyUpstreamError(e: unknown): UpstreamFailureReason {
  if (!isAxiosError(e)) {
    return 'unknown';
  }

  if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') {
    return 'timeout';
  }

  const status = e.response?.status;
  if (status === undefined) {
    return 'unreachable';
  }

  if (status === 401 || status === 403) {
    return 'auth';
  }

  return 'bad_response';
}
