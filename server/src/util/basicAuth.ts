import crypto from 'node:crypto';
import type {
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction,
  onRequestHookHandler,
} from 'fastify';

interface BasicAuthConfig {
  username: string;
  password: string;
}

function unauthorized(reply: FastifyReply) {
  reply.header('WWW-Authenticate', 'Basic realm="Tunarr"');
  return reply.status(401).send('Authentication required');
}

function hash(value: string) {
  return crypto.createHash('sha256').update(value).digest();
}

export function safeEqual(a: string, b: string) {
  return crypto.timingSafeEqual(hash(a), hash(b));
}

export function validateBasicAuth(
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

    const userMatches = safeEqual(user, expectedUser);
    const passMatches = safeEqual(pass, expectedPass);

    return userMatches && passMatches;
  } catch {
    return false;
  }
}

export function createTunarrBasicAuthHook(
  config: BasicAuthConfig,
): onRequestHookHandler {
  return (
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction,
  ) => {
    if (request.routeOptions.config?.authRequired === false) {
      done();
      return;
    }

    const ok = validateBasicAuth(
      request.headers.authorization,
      config.username,
      config.password,
    );

    if (!ok) {
      void unauthorized(reply);
      return;
    }

    done();
  };
}
