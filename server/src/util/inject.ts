import {
  type Bind,
  type Factory,
  type ResolutionContext,
  type ServiceIdentifier,
} from 'inversify';
import { isMainThread } from 'node:worker_threads';
import { LoggerFactory } from './logging/LoggerFactory.ts';
import type { LoggingDefinition } from './logging/loggingDef.ts';

export function bindFactoryFunc<Ret, Params extends unknown[]>(
  bind: Bind,
  key: ServiceIdentifier<Factory<Ret, Params>>,
  func: (ctx: ResolutionContext) => Factory<Ret, Params>,
) {
  return bind<Factory<Ret, Params>>(key).toFactory(func);
}

export function bindAutoFactory<
  FactoryT extends Factory<unknown>,
  Ret = FactoryT extends Factory<infer Out> ? Out : never,
  Params extends unknown[] = FactoryT extends Factory<unknown, infer Args>
    ? Args
    : never,
>(
  bind: Bind,
  key: ServiceIdentifier<Factory<Ret, Params>>,
  to: ServiceIdentifier<Ret>,
) {
  return bind<Factory<Ret, Params>>(key).toFactory(
    (ctx) => () => ctx.get<Ret>(to),
  );
}

export function InjectLogger(): PropertyDecorator {
  const cacheKey = Symbol.for('__tunarr_logger');
  return (target: object, propertyKey: string | symbol) => {
    Object.defineProperty(target, propertyKey, {
      get(this: Record<string | symbol, unknown>) {
        if (!this[cacheKey]) {
          if (!LoggerFactory.isInitialized) {
            return LoggerFactory.root;
          }
          const loggingDef = Reflect.get(this.constructor, 'tunarr:log_def') as
            | LoggingDefinition
            | undefined;
          this[cacheKey] = LoggerFactory.child({
            className: this.constructor.name,
            worker: isMainThread ? undefined : true,
            category: loggingDef?.category,
          });
        }
        return this[cacheKey];
      },
      set(this: Record<string | symbol, unknown>, value: unknown) {
        this[cacheKey] = value;
      },
      configurable: true,
    });
  };
}
