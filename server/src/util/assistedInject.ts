import type {
  Bind,
  BindWhenOnFluentSyntax,
  Factory,
  ServiceIdentifier,
} from 'inversify';
import { inject, multiInject } from 'inversify';
import 'reflect-metadata';

const INJECT_META = Symbol('assistedInject:inject');
const ASSISTED_META = Symbol('assistedInject:assisted');

function commonInjectedWrapper<T>(
  serviceId: ServiceIdentifier<T>,
  decorator: MethodDecorator & ParameterDecorator & PropertyDecorator,
): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    index: number,
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const map: Map<number, ServiceIdentifier<unknown>> = Reflect.getOwnMetadata(
      INJECT_META,
      target,
    ) ?? new Map();
    map.set(index, serviceId);
    Reflect.defineMetadata(INJECT_META, map, target);
    decorator(target, propertyKey, index);
  };
}

// Our own @inject — stores tokens in our own metadata, not inversify's internals
export function injected(serviceId: ServiceIdentifier<unknown>) {
  const injectFn = inject(serviceId);
  return commonInjectedWrapper(serviceId, injectFn);
}

// Our own @inject — stores tokens in our own metadata, not inversify's internals
export function multiInjected<T extends unknown[]>(
  serviceId: ServiceIdentifier<T>,
) {
  const injectFn = multiInject(serviceId);
  return commonInjectedWrapper(serviceId, injectFn);
}

export function assisted(
  target: object,
  _: string | symbol | undefined,
  index: number,
) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const set: Set<number> =
    Reflect.getOwnMetadata(ASSISTED_META, target) ?? new Set();
  set.add(index);
  Reflect.defineMetadata(ASSISTED_META, set, target);
}

export function bindAssistedFactory<
  TOut,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TFactory extends (...args: any[]) => TOut,
>(
  bind: Bind,
  factoryId: ServiceIdentifier<TFactory>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Target: new (...args: any[]) => TOut,
): BindWhenOnFluentSyntax<Factory<TOut>> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const injectMap: Map<
    number,
    ServiceIdentifier<unknown>
  > = Reflect.getOwnMetadata(INJECT_META, Target) ?? new Map();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const assistedSet: Set<number> =
    Reflect.getOwnMetadata(ASSISTED_META, Target) || new Set();
  const paramCount = Target.length;

  // Validate: every param must be either injected or assisted
  for (let i = 0; i < paramCount; i++) {
    if (!injectMap.has(i) && !assistedSet.has(i)) {
      throw new Error(
        `${Target.name}: param ${i} has neither @injected nor @assisted`,
      );
    }
  }

  return bind<Factory<TOut>>(factoryId).toFactory((context) => {
    return (...assistedArgs: Parameters<TFactory>): TOut => {
      const args: unknown[] = [];
      let aIdx = 0;
      for (let i = 0; i < paramCount; i++) {
        if (injectMap.has(i)) {
          args.push(context.get(injectMap.get(i)!));
        } else {
          args.push(assistedArgs[aIdx++]);
        }
      }
      return new Target(...args);
    };
  });
}
