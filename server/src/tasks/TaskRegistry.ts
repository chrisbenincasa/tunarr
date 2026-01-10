import type { ZodUndefined } from 'zod';
import z from 'zod';
import type { Task2 } from './Task.ts';

class TaskRegistryImpl {
  private static REGISTRY = new Map<string, TaskDefintion<z.ZodType>>();

  register(taskDef: TaskDefintion<z.ZodType>) {
    TaskRegistryImpl.REGISTRY.set(taskDef.name, taskDef);
  }

  getAll() {
    console.log(TaskRegistryImpl.REGISTRY);
    return Object.fromEntries(TaskRegistryImpl.REGISTRY);
  }
}

export const TaskRegistry = new TaskRegistryImpl();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerTask<T extends { new (...args: any[]): Task2 }>(
  constructor: T,
) {
  // TaskRegistry.register(constructor.name);
}

type TaskDefintion<T extends z.ZodType> = {
  name?: string;
  description?: string;
  schema: T;
};

type SimpleTaskDefinition = {
  name?: string;
  description?: string;
};

export function taskDef<Schema extends z.ZodType>(def: TaskDefintion<Schema>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function <T extends { new (...args: any[]): Task2<Schema> }>(
    constructor: T,
  ) {
    def.name ??= constructor.name;
    Reflect.set(constructor, 'tunarr:task_def', def);
    TaskRegistry.register(def);
  };
}

export function simpleTaskDef(def: SimpleTaskDefinition = {}) {
  return taskDef({
    ...def,
    schema: z.undefined(),
  } satisfies TaskDefintion<ZodUndefined>);
}
