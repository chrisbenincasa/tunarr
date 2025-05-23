import createError from '@fastify/error';
import type {
  FastifyPluginAsync,
  FastifyPluginCallback,
  FastifyPluginOptions,
  FastifySchema,
  FastifySchemaCompiler,
  FastifyTypeProvider,
  RawServerBase,
  RawServerDefault,
} from 'fastify';
import type { FastifySerializerCompiler } from 'fastify/types/schema.js';
import { has } from 'lodash-es';
import z from 'zod/v4';
import type { $ZodType } from 'zod/v4/core';

export interface ZodTypeProvider extends FastifyTypeProvider {
  validator: this['schema'] extends z.ZodType
    ? z.output<this['schema']>
    : unknown;
  serializer: this['schema'] extends z.ZodType
    ? z.input<this['schema']>
    : unknown;
}

export type FastifyPluginCallbackZod<
  Options extends FastifyPluginOptions = Record<never, never>,
  Server extends RawServerBase = RawServerDefault,
> = FastifyPluginCallback<Options, Server, ZodTypeProvider>;

export type FastifyPluginAsyncZod<
  Options extends FastifyPluginOptions = Record<never, never>,
  Server extends RawServerBase = RawServerDefault,
> = FastifyPluginAsync<Options, Server, ZodTypeProvider>;

export const validatorCompiler: FastifySchemaCompiler<z.ZodType> =
  ({ schema }) =>
  (data) => {
    const result = schema.safeParse(data);
    if (result.error) {
      return { error: result.error };
    }
    return { value: result.data };
  };

export const InvalidSchemaError = createError<[string]>(
  'FST_ERR_INVALID_SCHEMA',
  'Invalid schema passed: %s',
  500,
);

function resolveSchema(
  maybeSchema: z.ZodTypeAny | { properties: z.ZodTypeAny },
): z.ZodTypeAny {
  if ('safeParse' in maybeSchema) {
    return maybeSchema;
  }
  if ('properties' in maybeSchema) {
    return maybeSchema.properties;
  }
  throw new InvalidSchemaError(JSON.stringify(maybeSchema));
}

export const createSerializerCompiler =
  (): FastifySerializerCompiler<z.ZodTypeAny | { properties: z.ZodTypeAny }> =>
  ({ schema: maybeSchema, method, url }) =>
  (data) => {
    const schema = resolveSchema(maybeSchema);

    const result = schema.safeParse(data);
    if (result.error) {
      throw new ResponseSerializationError(method, url, {
        cause: result.error,
      });
    }

    return JSON.stringify(result.data);
  };

export const serializerCompiler = createSerializerCompiler();

export class ResponseSerializationError extends createError<
  [{ cause: z.ZodError }]
>('FST_ERR_RESPONSE_SERIALIZATION', "Response doesn't match the schema", 500) {
  cause!: z.ZodError;

  constructor(
    public method: string,
    public url: string,
    options: { cause: z.ZodError },
  ) {
    super({ cause: options.cause });
  }
}

export function isResponseSerializationError(
  value: unknown,
): value is ResponseSerializationError {
  return 'method' in (value as ResponseSerializationError);
}

function isZodSchema(x: unknown): x is $ZodType {
  return has(x, '_zod');
}

type Transform<S extends FastifySchema = FastifySchema> = {
  schema: S;
  url: string;
};

type TransformOut = { schema: FastifySchema; url: string };

export const swaggerTransform = <S extends FastifySchema = FastifySchema>({
  schema,
  url,
}: Transform<S>): TransformOut => {
  if (!schema) {
    return { schema, url };
  }
  const { response, headers, querystring, body, params, hide, ...rest } =
    schema;

  const transformed: Record<string, unknown> = {};

  if (hide) {
    transformed.hide = true;
    return { schema: transformed, url };
  }

  const zodSchemas: Record<string, unknown> = {
    headers,
    querystring,
    body,
    params,
  };

  for (const prop in zodSchemas) {
    const zodSchema = zodSchemas[prop];
    if (isZodSchema(zodSchema)) {
      transformed[prop] = z.toJSONSchema(zodSchema, { unrepresentable: 'any' });
    }
  }

  if (response) {
    const resp = {} as Record<string, unknown>;
    for (const prop in response) {
      const schema: unknown = response[prop];
      if (isZodSchema(schema)) {
        resp[prop] = z.toJSONSchema(schema, { unrepresentable: 'any' });
      }
    }
    transformed.response = resp;
  }

  for (const prop in rest) {
    const meta: unknown = rest[prop];
    if (meta) {
      transformed[prop] = meta;
    }
  }

  return { schema: transformed, url };
};
