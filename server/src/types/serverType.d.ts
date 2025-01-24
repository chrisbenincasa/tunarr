import {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyPluginAsync,
  FastifyPluginCallback,
  RawServerDefault,
  RouteGenericInterface,
} from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { FastifyRequest } from 'fastify/types/request.d.ts';
import type { FastifySchema } from 'fastify/types/schema.d.ts';
import type { ResolveFastifyRequestType } from 'fastify/types/type-provider.d.ts';
import { IncomingMessage, ServerResponse } from 'http';
import { z } from 'zod';

export type ServerType = FastifyInstance<
  RawServerDefault,
  IncomingMessage,
  ServerResponse<IncomingMessage>,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export type RouterPluginCallback = FastifyPluginCallback<
  Record<never, never>,
  RawServerDefault,
  ZodTypeProvider
>;

export type RouterPluginAsyncCallback = FastifyPluginAsync<
  Record<never, never>,
  RawServerDefault,
  ZodTypeProvider
>;

export type ZodFastifySchema = {
  body?: z.AnyZodObject;
  querystring?: z.AnyZodObject;
  params?: z.AnyZodObject;
  headers?: z.AnyZodObject;
  response?: z.AnyZodObject;
};

export type ZodFastifyRequest<Schema extends FastifySchema = ZodFastifySchema> =
  FastifyRequest<
    RouteGenericInterface,
    RawServerDefault,
    IncomingMessage,
    Readonly<Schema>,
    ZodTypeProvider,
    unknown,
    FastifyBaseLogger,
    ResolveFastifyRequestType<
      ZodTypeProvider,
      Readonly<Schema>,
      RouteGenericInterface
    >
  >;
