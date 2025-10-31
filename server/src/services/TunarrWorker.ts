import { inject, injectable } from 'inversify';
import PQueue from 'p-queue';
import { parentPort } from 'worker_threads';
import { KEYS } from '../types/inject.ts';
import { Result } from '../types/result.ts';
import {
  WorkerReply,
  WorkerRequest,
  WorkerScheduleSlotsRequest,
  WorkerScheduleTimeSlotsRequest,
  WorkerSuccessReply,
  WorkerTimeSlotScheduleReply,
  type WorkerEvent,
} from '../types/worker_schemas.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import { SlotSchedulerService } from './scheduling/RandomSlotSchedulerService.ts';
import { TimeSlotSchedulerService } from './scheduling/TimeSlotSchedulerService.ts';

@injectable()
export class TunarrWorker {
  #queue: PQueue;

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(TimeSlotSchedulerService)
    private timeSlotSchedulerService: TimeSlotSchedulerService,
    @inject(SlotSchedulerService)
    private slotSchedulerService: SlotSchedulerService,
  ) {
    // How many tasks the worker pool can handle simultaneously
    // TODO: Make this configurable
    this.#queue = new PQueue({
      concurrency: 2,
    });
  }

  start() {
    this.logger.info('Tunarr worker started');
    parentPort?.postMessage({
      type: 'event',
      eventType: 'started',
      message: 'Worker successfully started!',
    } satisfies WorkerEvent);

    parentPort?.on('message', (message) => {
      const parsed = WorkerRequest.safeParse(message);
      if (parsed.error) {
        this.logger.error(parsed.error, 'Error parsing worker request message');
        return;
      }

      this.#queue
        .add(async () => {
          const requestId = parsed.data.requestId;

          switch (parsed.data.type) {
            case 'status':
              this.sendSuccessReply(requestId, {
                type: 'status',
                status: 'healthy',
              });
              break;
            case 'time-slots':
              return this.handleTimeSlots(parsed.data);
            case 'schedule-slots':
              return this.handleSlots(parsed.data);
            case 'restart':
              process.exit(parsed.data.code ?? 1);
          }
        })
        .catch(console.error);
    });
  }

  private async handleTimeSlots(req: WorkerScheduleTimeSlotsRequest) {
    const result = await Result.attemptAsync(() =>
      this.timeSlotSchedulerService.schedule(req.request),
    );

    if (result.isFailure()) {
      this.logger.error(result.error);
      this.sendReply({
        type: 'error',
        requestId: req.requestId,
        message: result.error.message,
      });
      return;
    }

    this.sendSuccessReply(req.requestId, {
      result: result.get(),
      type: 'time-slots',
    } satisfies WorkerTimeSlotScheduleReply);
  }

  private async handleSlots(req: WorkerScheduleSlotsRequest) {
    const result = await Result.attemptAsync(() =>
      this.slotSchedulerService.schedule(req.request),
    );

    if (result.isFailure()) {
      this.logger.error(result.error);
      this.sendReply({
        type: 'error',
        requestId: req.requestId,
        message: result.error.message,
      });
      return;
    }

    this.sendSuccessReply(req.requestId, {
      result: result.get(),
      type: 'schedule-slots',
    });
  }

  private sendSuccessReply(
    requestId: string,
    data: WorkerSuccessReply['data'],
  ) {
    this.sendReply({
      type: 'success',
      data,
      requestId,
    });
  }

  private sendReply(reply: WorkerReply) {
    parentPort?.postMessage(reply);
  }
}
