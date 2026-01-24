import { SimpleTask } from './Task.ts';

export class NoopTask extends SimpleTask {
  // eslint-disable-next-line @typescript-eslint/require-await
  protected async runInternal(): Promise<void> {
    return;
  }
}
