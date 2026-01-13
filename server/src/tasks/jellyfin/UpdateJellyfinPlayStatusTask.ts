import type { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { GlobalScheduler } from '@/services/Scheduler.js';
import { ScheduledTask } from '@/tasks/ScheduledTask.js';
import { Task2 } from '@/tasks/Task.js';
import { run } from '@/util/index.js';
import dayjs from 'dayjs';
import { injectable } from 'inversify';
import { RecurrenceRule } from 'node-schedule';
import { v4 } from 'uuid';
import z from 'zod';
import type { MediaSourceWithRelations } from '../../db/schema/derivedTypes.js';

type UpdateJellyfinPlayStatusScheduleRequest = {
  first: boolean;
  itemId: string;
  itemStartPositionMs: number;
  itemDuration: number;
  channelNumber: number;
};

// type UpdateJellyfinPlayStatusInvocation =
//   UpdateJellyfinPlayStatusScheduleRequest & {
//     playState: PlayState;
//     sessionId: string;
//     elapsedMs: number;
//   };

type PlayState = 'playing' | 'stopped';

const UpdateJellyfinPlayStatusScheduleRequest = z.object({
  first: z.boolean(),
  itemId: z.string(),
  itemStartPositionMs: z.number(),
  itemDuration: z.number(),
  channelNumber: z.number(),
});

const UpdateJellyfinPlayStatusTaskInvocation = z.object({
  ...UpdateJellyfinPlayStatusScheduleRequest.shape,
  playState: z.enum(['playing', 'stopped']),
  sessionId: z.string(),
  elapsedMs: z.number(),
});

type UpdateJellyfinPlayStatusTaskInvocation = z.infer<
  typeof UpdateJellyfinPlayStatusTaskInvocation
>;

@injectable()
export class UpdateJellyfinPlayStatusScheduledTask extends ScheduledTask<
  typeof UpdateJellyfinPlayStatusTaskInvocation,
  boolean
> {
  private playState: PlayState = 'playing';
  private first: boolean = true;
  private start = dayjs();

  constructor(
    private jellyfinServer: MediaSourceWithRelations,
    private request: UpdateJellyfinPlayStatusScheduleRequest,
    private mediaSourceApiFactory: MediaSourceApiFactory,
    public sessionId: string = v4(),
  ) {
    super(
      UpdateJellyfinPlayStatusScheduledTask.name,
      run(() => {
        const rule = new RecurrenceRule();
        rule.second = 30;
        return rule;
      }),
      () => this.getNextTask(),
      () => this.getInvocationArgs(),
      { visible: false },
    );

    // Kick off leading edge task
    GlobalScheduler.scheduleOneOffTask(
      UpdateJellyfinPlayStatusTask.name,
      dayjs().add(1, 'second'),
      this.getInvocationArgs(),
      this.getNextTask(),
    );
  }

  get id() {
    return `${this.name}_${this.sessionId}`;
  }

  stop() {
    this.scheduledJob.cancel(false);
    this.playState = 'stopped';
    GlobalScheduler.scheduleOneOffTask(
      UpdateJellyfinPlayStatusTask.name,
      dayjs().add(30, 'seconds').toDate(),
      this.getInvocationArgs(),
      this.getNextTask(),
    );
  }

  private getInvocationArgs() {
    const args = {
      ...this.request,
      playState: this.playState,
      sessionId: this.sessionId,
      first: this.first,
      elapsedMs: dayjs.duration(dayjs().diff(this.start)).asMilliseconds(),
      itemStartPositionMs: Math.min(
        this.request.itemStartPositionMs + 30000,
        this.request.itemDuration,
      ),
    };
    if (this.first) {
      this.first = false;
    }
    return args;
  }

  private getNextTask(): UpdateJellyfinPlayStatusTask {
    const task = new UpdateJellyfinPlayStatusTask(
      this.jellyfinServer,
      this.mediaSourceApiFactory,
    );

    this.request = this.getInvocationArgs();

    if (this.first) {
      this.first = false;
    }

    return task;
  }
}

@injectable()
class UpdateJellyfinPlayStatusTask extends Task2<
  typeof UpdateJellyfinPlayStatusTaskInvocation,
  boolean
> {
  public ID: string = UpdateJellyfinPlayStatusTask.name;
  schema = UpdateJellyfinPlayStatusTaskInvocation;

  get taskName(): string {
    return this.ID;
  }

  constructor(
    private jellyfinServer: MediaSourceWithRelations,
    private mediaSourceApiFactory: MediaSourceApiFactory,
  ) {
    super();
  }

  protected async runInternal(
    request: UpdateJellyfinPlayStatusTaskInvocation,
  ): Promise<boolean> {
    const jellyfin =
      await this.mediaSourceApiFactory.getJellyfinApiClientForMediaSource(
        this.jellyfinServer,
      );

    const deviceName = `tunarr-channel-${request.channelNumber}`;
    try {
      if (request.first) {
        await jellyfin.recordPlaybackStart(request.itemId, deviceName);
      } else if (request.playState === 'playing') {
        await jellyfin.recordPlaybackProgress(
          request.itemId,
          request.elapsedMs,
          deviceName,
        );
      } else {
        await jellyfin.recordPlaybackProgress(
          request.itemId,
          request.elapsedMs,
          deviceName,
        );
      }

      await jellyfin.updateUserItemPlayback(request.itemId, request.elapsedMs);
    } catch (error) {
      this.logger.warn(
        error,
        `Problem updating Jellyfin status using status URL for item ${request.itemId}: `,
      );
      return false;
    }

    return true;
  }
}
