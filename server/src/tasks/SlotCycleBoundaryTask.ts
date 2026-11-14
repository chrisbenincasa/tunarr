import { SlotCycleBoundaryService } from '@/services/scheduling/SlotCycleBoundaryService.js';
import { inject, injectable } from 'inversify';
import { SimpleTask } from './Task.ts';
import { simpleTaskDef } from './TaskRegistry.ts';

/**
 * Moves every rebuilding slot channel past its cycle boundaries.
 *
 * It runs at startup as well as on its schedule. Catch-up is decided by the
 * channel's own state rather than a flag, so the startup run heals a channel
 * whose cycles all aired while the server was down.
 */
@injectable()
@simpleTaskDef({
  description:
    'Builds the next cycle of channels that rebuild their schedule each cycle.',
})
export class SlotCycleBoundaryTask extends SimpleTask {
  static KEY = Symbol.for(SlotCycleBoundaryTask.name);
  static ID = SlotCycleBoundaryTask.name;

  public ID = SlotCycleBoundaryTask.ID;

  constructor(
    @inject(SlotCycleBoundaryService)
    private boundaryService: SlotCycleBoundaryService,
  ) {
    super();
  }

  protected async runInternal(): Promise<void> {
    await this.boundaryService.advanceAll();
  }
}
