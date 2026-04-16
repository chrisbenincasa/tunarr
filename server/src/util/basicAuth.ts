import crypto from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const PUBLIC_EXACT_PATHS = new Set([
  '/',
  '/device.xml',
  '/discover.json',
  '/lineup.json',
  '/lineup_status.json',
  '/api/xmltv.xml',
  '/api/channels.m3u',
  '/favicon.ico',
  '/favicon.svg',
]);

const PUBLIC_PREFIXES = [
  '/stream/',
  '/images/',
  '/images/uploads/',
  '/cache/images/',
];

function isPublicPath(url: string) {
  const path = url.split('?')[0] ?? url;

  if (PUBLIC_EXACT_PATHS.has(path)) {
    return true;
  }

  return PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function unauthorized(reply: FastifyReply) {
  reply.header('WWW-Authenticate', 'Basic realm="Tunarr"');
  return reply.status(401).send('Authentication required');
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);

  if (aBuf.length !== bBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuf, bBuf);
}

function validateBasicAuth(
  authHeader: string | undefined,
  expectedUser: string,
  expectedPass: string,
) {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const encoded = authHeader.slice(6).trim();
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const idx = decoded.indexOf(':');

    if (idx < 0) {
      return false;
    }

    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);

    return safeEqual(user, expectedUser) && safeEqual(pass, expectedPass);
  } catch {
    return false;
  }
}

export async function tunarrBasicAuthHook(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const expectedUser = process.env.TUNARR_BASIC_AUTH_USER;
  const expectedPass = process.env.TUNARR_BASIC_AUTH_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return;
  }

  if (isPublicPath(request.url)) {
    return;
  }

  const ok = validateBasicAuth(
    request.headers.authorization,
    expectedUser,
    expectedPass,
  );

  if (!ok) {
    return unauthorized(reply);
  }
}