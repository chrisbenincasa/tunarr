import fastify, {
  FastifyInstance,
  FastifyPluginCallback,
  RawServerDefault,
} from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { IncomingMessage, ServerResponse } from 'http';

export type ServerType = FastifyInstance<
  RawServerDefault,
  IncomingMessage,
  ServerResponse<IncomingMessage>,
  fastify.FastifyBaseLogger,
  ZodTypeProvider
>;

export type RouterPluginCallback = FastifyPluginCallback<
  Record<never, never>,
  RawServerDefault,
  ZodTypeProvider
>;
