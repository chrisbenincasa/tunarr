import type { ServiceIdentifier } from 'inversify';
import type { MarkOptional, StrictOmit } from 'ts-essentials';
import type { ZodUndefined } from 'zod';
import z from 'zod';
import type { Task2, TaskConstructor } from './Task.ts';

class TaskRegistryImpl {
  private static REGISTRY = new Map<string, TaskDefintion<z.ZodType>>();

  register(taskDef: TaskDefintion<z.ZodType>) {
    TaskRegistryImpl.REGISTRY.set(taskDef.name, taskDef);
  }

  getTask(id: string) {
    return TaskRegistryImpl.REGISTRY.get(id);
  }

  getAll() {
    const visibleTasks: Record<string, TaskDefintion<z.ZodType>> = {};
    for (const [name, def] of TaskRegistryImpl.REGISTRY.entries()) {
      if (def.hidden) {
        continue;
      }
      visibleTasks[name] = def;
    }
    return visibleTasks;
  }
}

export const TaskRegistry = new TaskRegistryImpl();

type TaskDefintion<
  T extends z.ZodType,
  TaskType extends Task2<T, unknown> = Task2<T, unknown>,
> = {
  name: string;
  description?: string;
  schema: T;
  hidden?: boolean;
  injectKey: ServiceIdentifier<TaskType | (() => TaskType)>;
};

type ProvidedTaskDefinition<Schema extends z.ZodType> = MarkOptional<
  TaskDefintion<Schema>,
  'name' | 'injectKey'
>;

type SimpleTaskDefinition = Partial<
  StrictOmit<TaskDefintion<z.ZodUndefined>, 'schema'>
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExtractTaskType<Constructor extends TaskConstructor<any, unknown>> =
  Constructor extends TaskConstructor<any, unknown, infer OutT> ? OutT : never;

export function taskDef<Schema extends z.ZodType, OutTypeT>(
  def: ProvidedTaskDefinition<Schema>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function <T extends TaskConstructor<Schema, OutTypeT>>(
    constructor: T,
  ) {
    def.name ??= constructor.name;
    def.injectKey ??= constructor;
    Reflect.set(constructor, 'tunarr:task_def', def);
    TaskRegistry.register(def as TaskDefintion<Schema, ExtractTaskType<T>>);
  };
}

export function simpleTaskDef(def: SimpleTaskDefinition = {}) {
  return taskDef({
    ...def,
    schema: z.undefined(),
  } satisfies ProvidedTaskDefinition<ZodUndefined>);
}
