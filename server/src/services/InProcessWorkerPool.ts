import { inject, injectable } from 'inversify';
import { StrictOmit } from 'ts-essentials';
import { match } from 'ts-pattern';
import { z } from 'zod/v4';
import { IWorkerPool } from '../interfaces/IWorkerPool.ts';
import { KEYS } from '../types/inject.ts';
import {
  WorkerRequest,
  WorkerRequestToResponse,
} from '../types/worker_schemas.ts';
import dayjs from '../util/dayjs.ts';
import { USE_WORKER_POOL_ENV_VAR } from '../util/env.ts';
import { isNonEmptyString } from '../util/index.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import { SlotSchedulerService } from './scheduling/RandomSlotSchedulerService.ts';
import { TimeSlotSchedulerService } from './scheduling/TimeSlotSchedulerService.ts';
import { TVGuideService } from './TvGuideService.ts';

type OutTypes = typeof WorkerRequestToResponse;

/**
 * Just runs the tasks!
 */
@injectable()
export class InProcessWorkerPool implements IWorkerPool {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(TimeSlotSchedulerService)
    private timeSlotSchedulerService: TimeSlotSchedulerService,
    @inject(SlotSchedulerService)
    private slotSchedulerService: SlotSchedulerService,
    @inject(TVGuideService) private guideService: TVGuideService,
  ) {}

  start() {
    this.logger.info(
      'Running no-op worker pool. To run separate worker threads, set the %s env variable to true',
      USE_WORKER_POOL_ENV_VAR,
    );
    return Promise.resolve(void 0);
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
    return (
      match(request as WorkerRequest)
        // .returnType<Promise<Out>>()
        .with({ type: 'status' }, () =>
          Promise.resolve<Out>({
            status: 'healthy',
            type: 'status',
          } as Out),
        )
        .with({ type: 'restart' }, () => {
          return Promise.resolve<Out>(void 0 as Out);
        })
        .with({ type: 'time-slots' }, async ({ request, type }) => {
          const result = await this.timeSlotSchedulerService.schedule({
            ...request,
            materializeResult: false,
          });
          return {
            result,
            type,
          } satisfies z.infer<OutTypes[typeof type]>;
        })
        .with({ type: 'schedule-slots' }, async ({ request, type }) => {
          const result = await this.slotSchedulerService.schedule({
            ...request,
            materializeResult: false,
          });

          return {
            result,
            type,
          };
        })
        .with({ type: 'build-guide' }, async (request) => {
          if (isNonEmptyString(request.channelId)) {
            await this.guideService.refreshGuide(
              dayjs.duration({ hours: request.guideDurationHours }),
              request.channelId,
              request.writeXmlTv,
              request.force,
              request.startTime ?? +dayjs(),
            );
          } else {
            await this.guideService.buildAllChannels(
              dayjs.duration({ hours: request.guideDurationHours }),
              request.force,
            );
          }
        })
        .exhaustive() as Promise<Out>
    );
  }
}
