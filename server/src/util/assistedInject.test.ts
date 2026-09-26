import { Container, injectable } from 'inversify';
import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import {
  assisted,
  bindAssistedFactory,
  injected,
  multiInjected,
} from './assistedInject.ts';

const SINGLE = Symbol.for('test:single');
const MULTI = Symbol.for('test:multi');
const FACTORY = Symbol.for('test:factory');

interface Plugin {
  name: string;
}

@injectable()
class PluginA implements Plugin {
  name = 'A';
}

@injectable()
class PluginB implements Plugin {
  name = 'B';
}

@injectable()
class SingleDep {
  value = 'single';
}

class Target {
  constructor(
    @injected(SINGLE) public single: SingleDep,
    @multiInjected(MULTI) public plugins: Plugin[],
    @assisted public extra: string,
  ) {}
}

describe('assistedInject', () => {
  test('resolves a @multiInjected param via getAll when multiple bindings exist', () => {
    const container = new Container();
    container.bind(SingleDep).toSelf();
    container.bind(SINGLE).toService(SingleDep);
    container.bind(MULTI).to(PluginA);
    container.bind(MULTI).to(PluginB);
    bindAssistedFactory(container.bind.bind(container), FACTORY, Target);

    const factory = container.get<(extra: string) => Target>(FACTORY);
    const result = factory('assisted-value');

    expect(result.single).toBeInstanceOf(SingleDep);
    expect(result.plugins.map((p) => p.name).sort()).toEqual(['A', 'B']);
    expect(result.extra).toBe('assisted-value');
  });

  test('resolves a @multiInjected param to a single-element array with one binding', () => {
    const container = new Container();
    container.bind(SingleDep).toSelf();
    container.bind(SINGLE).toService(SingleDep);
    container.bind(MULTI).to(PluginA);
    bindAssistedFactory(container.bind.bind(container), FACTORY, Target);

    const factory = container.get<(extra: string) => Target>(FACTORY);
    const result = factory('assisted-value');

    expect(result.plugins.map((p) => p.name)).toEqual(['A']);
  });
});
