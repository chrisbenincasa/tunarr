import {
  Bind,
  BindWhenOnFluentSyntax,
  Factory,
  ServiceIdentifier,
} from 'inversify';
import 'reflect-metadata';

const INJECT_META = Symbol('assistedInject:inject');
const ASSISTED_META = Symbol('assistedInject:assisted');

// Our own @inject — stores tokens in our own metadata, not inversify's internals
export function injected(serviceId: ServiceIdentifier<unknown>) {
  return (target: object, _: string | symbol | undefined, index: number) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const map: Map<number, ServiceIdentifier<unknown>> = Reflect.getOwnMetadata(
      INJECT_META,
      target,
    ) ?? new Map();
    map.set(index, serviceId);
    Reflect.defineMetadata(INJECT_META, map, target);
  };
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function bindAssistedFactory<TFactory extends (...args: any[]) => any>(
  bind: Bind,
  factoryId: ServiceIdentifier<TFactory>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Target: new (...args: any[]) => ReturnType<TFactory>,
): BindWhenOnFluentSyntax<Factory<ReturnType<TFactory>>> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const injectMap: Map<
    number,
    ServiceIdentifier<unknown>
  > = Reflect.getOwnMetadata(INJECT_META, Target) ?? new Map();
  // BRITTLE
  console.log(
    Reflect.getOwnMetadata('@inversifyjs/core/classMetadataReflectKey', Target),
  );
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

  return bind<Factory<ReturnType<TFactory>>>(factoryId).toFactory((context) => {
    return (...assistedArgs: Parameters<TFactory>): ReturnType<TFactory> => {
      const args: unknown[] = [];
      let aIdx = 0;
      for (let i = 0; i < paramCount; i++) {
        if (injectMap.has(i)) {
          args.push(context.get(injectMap.get(i)!));
        } else {
          args.push(assistedArgs[aIdx++]);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return new Target(...args);
    };
  });
}
