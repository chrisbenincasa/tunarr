import { inject, injectable } from 'inversify';
import type { StrictOmit } from 'ts-essentials';
import type { z } from 'zod/v4';
import type { IWorkerPool } from '../interfaces/IWorkerPool.ts';

import type {
  WorkerRequest,
  WorkerRequestToResponse,
} from '../types/worker_schemas.ts';
import { USE_WORKER_POOL_ENV_VAR } from '../util/env.ts';
import { InjectLogger } from '../util/inject.ts';
import type { Logger } from '../util/logging/LoggerFactory.ts';
import { SlotSchedulerService } from './scheduling/RandomSlotSchedulerService.ts';
import { TimeSlotSchedulerService } from './scheduling/TimeSlotSchedulerService.ts';

type OutTypes = typeof WorkerRequestToResponse;

/**
 * Does nothing, just runs the tasks!
 */
@injectable()
export class NoopWorkerPool implements IWorkerPool {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(TimeSlotSchedulerService)
    private timeSlotSchedulerService: TimeSlotSchedulerService,
    @inject(SlotSchedulerService)
    private slotSchedulerService: SlotSchedulerService,
  ) {}

  start(): void {
    this.logger.debug(
      'Running no-op worker pool. To run separate worker threads, set the %s env variable to true',
      USE_WORKER_POOL_ENV_VAR,
    );
  }

  shutdown(_timeout: number): Promise<void> {
    return Promise.resolve(void 0);
  }

  allReady(): Promise<void> {
    return Promise.resolve(void 0);
  }

  async queueTask<
    Req extends StrictOmit<WorkerRequest, 'requestId'>,
    Out = z.infer<(typeof WorkerRequestToResponse)[Req['type']]>,
  >(request: Req, _timeout?: number): Promise<Out> {
    const workerRequest = request as WorkerRequest;
    switch (workerRequest.type) {
      case 'status':
        return {
          status: 'healthy',
          type: 'status',
        } as Out;
      case 'restart':
        return void 0 as Out;
      case 'time-slots': {
        const result = await this.timeSlotSchedulerService.schedule(
          workerRequest.request,
        );
        return {
          result,
          type: workerRequest.type,
        } satisfies z.infer<OutTypes['time-slots']> as Out;
      }
      case 'schedule-slots': {
        const result = await this.slotSchedulerService.schedule(
          workerRequest.request,
        );
        return {
          result,
          type: workerRequest.type,
        } as Out;
      }
    }
  }
}
