import z from 'zod';
import type { WrappedError } from '../types/errors.ts';
import { Result } from '../types/result.ts';
import { Task2 } from './Task.ts';
import { taskDef } from './TaskRegistry.ts';

@taskDef({
  name: TestTask.name,
  description: 'Does a thing',
  schema: z.undefined(),
})
export class TestTask extends Task2 {
  static test = 'string';
  schema = z.undefined();
  ID = TestTask.name;

  async runInternal(request: undefined): Promise<Result<void, WrappedError>> {
    return Result.success(void 0);
  }
}

console.log(Reflect.getMetadataKeys(TestTask));
