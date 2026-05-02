import type { FastifyTypeProvider } from 'fastify';
import type z from 'zod/v4';

export interface ZodTypeProvider extends FastifyTypeProvider {
  validator: this['schema'] extends z.ZodType
    ? z.output<this['schema']>
    : unknown;
  serializer: this['schema'] extends z.ZodType
    ? z.input<this['schema']>
    : unknown;
}
