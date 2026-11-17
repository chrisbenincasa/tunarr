import crypto from 'node:crypto';
import type {
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction,
  onRequestHookHandler,
} from 'fastify';
import { getEnvVar, TUNARR_ENV_VARS } from './env.ts';

export interface BasicAuthConfig {
  username: string;
  password: string;
}

export function basicAuthConfigFromEnv(): BasicAuthConfig | undefined {
  const username = getEnvVar(TUNARR_ENV_VARS.BASIC_AUTH_USER_ENV_VAR);
  const password = getEnvVar(TUNARR_ENV_VARS.BASIC_AUTH_PASSWORD_ENV_VAR);
  if (!username || !password) {
    return;
  }
  return { username, password };
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

// True when basic auth is off or the header carries valid credentials. Routes
// marked `authRequired: false` use it to hold back private data.
export function isAuthorized(
  authHeader: string | undefined,
  config: BasicAuthConfig | undefined,
) {
  return (
    !config || validateBasicAuth(authHeader, config.username, config.password)
  );
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
