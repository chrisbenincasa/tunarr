import type { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { GlobalScheduler } from '@/services/Scheduler.js';
import { ScheduledTask } from '@/tasks/ScheduledTask.js';
import { Task } from '@/tasks/Task.js';
import { run } from '@/util/index.js';
import dayjs from 'dayjs';
import { RecurrenceRule } from 'node-schedule';
import { v4 } from 'uuid';
import type { MediaSourceWithRelations } from '../../db/schema/derivedTypes.js';

type UpdateJellyfinPlayStatusScheduleRequest = {
  first: boolean;
  itemId: string;
  itemStartPositionMs: number;
  itemDuration: number;
  channelNumber: number;
};

type UpdateJellyfinPlayStatusInvocation =
  UpdateJellyfinPlayStatusScheduleRequest & {
    playState: PlayState;
    sessionId: string;
    elapsedMs: number;
  };

type PlayState = 'playing' | 'stopped';

export class UpdateJellyfinPlayStatusScheduledTask extends ScheduledTask {
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
      [],
      { visible: false },
    );

    // Kick off leading edge task
    GlobalScheduler.scheduleOneOffTask(
      UpdateJellyfinPlayStatusTask.name,
      dayjs().add(1, 'second'),
      [],
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
      [],
      this.getNextTask(),
    );
  }

  private getNextTask(): UpdateJellyfinPlayStatusTask {
    const task = new UpdateJellyfinPlayStatusTask(
      this.jellyfinServer,
      {
        ...this.request,
        playState: this.playState,
        sessionId: this.sessionId,
        elapsedMs: dayjs.duration(dayjs().diff(this.start)).asMilliseconds(),
      },
      this.mediaSourceApiFactory,
    );

    this.request = {
      ...this.request,
      first: this.first,
      itemStartPositionMs: Math.min(
        this.request.itemStartPositionMs + 30000,
        this.request.itemDuration,
      ),
    };

    if (this.first) {
      this.first = false;
    }

    return task;
  }
}

class UpdateJellyfinPlayStatusTask extends Task {
  public ID: string = UpdateJellyfinPlayStatusTask.name;

  get taskName(): string {
    return this.ID;
  }

  constructor(
    private jellyfinServer: MediaSourceWithRelations,
    private request: UpdateJellyfinPlayStatusInvocation,
    private mediaSourceApiFactory: MediaSourceApiFactory,
  ) {
    super();
  }

  protected async runInternal(): Promise<boolean> {
    const jellyfin =
      await this.mediaSourceApiFactory.getJellyfinApiClientForMediaSource(
        this.jellyfinServer,
      );

    const deviceName = `tunarr-channel-${this.request.channelNumber}`;
    try {
      if (this.request.first) {
        await jellyfin.recordPlaybackStart(this.request.itemId, deviceName);
      } else if (this.request.playState === 'playing') {
        await jellyfin.recordPlaybackProgress(
          this.request.itemId,
          this.request.elapsedMs,
          deviceName,
        );
      } else {
        await jellyfin.recordPlaybackProgress(
          this.request.itemId,
          this.request.elapsedMs,
          deviceName,
        );
      }

      await jellyfin.updateUserItemPlayback(
        this.request.itemId,
        this.request.elapsedMs,
      );
    } catch (error) {
      this.logger.warn(
        error,
        `Problem updating Jellyfin status using status URL for item ${this.request.itemId}: `,
      );
      return false;
    }

    return true;
  }
}
