import type { MediaSourceOrm } from '@/db/schema/MediaSource.js';
import { GlobalScheduler } from '@/services/Scheduler.js';
import { ScheduledTask } from '@/tasks/ScheduledTask.js';
import { Task2 } from '@/tasks/Task.js';
import { run } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { getTunarrVersion } from '@/util/version.js';
import { PlexClientIdentifier } from '@tunarr/shared/constants';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { RecurrenceRule } from 'node-schedule';
import z from 'zod';
import { MediaSourceWithRelations } from '../../db/schema/derivedTypes.js';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.js';
import { taskDef } from '../TaskRegistry.ts';

export type UpdatePlexPlayStatusScheduleRequest = {
  ratingKey: string;
  startTime: number;
  duration: number;
  channelNumber: number;
  updateIntervalSeconds?: number;
};

const UpdatePlexPlayStatusScheduleRequest = z.object({
  ratingKey: z.string(),
  startTime: z.number(),
  duration: z.number(),
  channelNumber: z.number(),
  updateIntervalSeconds: z.number().optional(),
});

const UpdatePlexPlayStatusTaskInvocation = z.object({
  ...UpdatePlexPlayStatusScheduleRequest.shape,
  playState: z.enum(['playing', 'stopped']),
  sessionId: z.string(),
});

type UpdatePlexPlayStatusTaskInvocation = z.infer<
  typeof UpdatePlexPlayStatusTaskInvocation
>;

type PlayState = 'playing' | 'stopped';

const StaticPlexHeaders = {
  'X-Plex-Product': 'Tunarr',
  'X-Plex-Platform': 'Generic',
  'X-Plex-Client-Platform': 'Generic',
  'X-Plex-Client-Profile-Name': 'Generic',
};

export type UpdatePlexPlayStatusScheduledTaskFactory = (
  plexServer: MediaSourceOrm,
  request: UpdatePlexPlayStatusScheduleRequest,
  sessionId: string,
) => UpdatePlexPlayStatusScheduledTask;

@injectable()
export class UpdatePlexPlayStatusScheduledTask extends ScheduledTask<
  typeof UpdatePlexPlayStatusTaskInvocation,
  boolean
> {
  static KEY = Symbol.for(UpdatePlexPlayStatusScheduledTask.name);

  private playState: PlayState = 'playing';

  constructor(
    private mediaSourceApiFactory: MediaSourceApiFactory,
    private plexServer: MediaSourceWithRelations,
    private request: UpdatePlexPlayStatusScheduleRequest,
    public sessionId: string,
  ) {
    super(
      UpdatePlexPlayStatusScheduledTask.name,
      run(() => {
        const rule = new RecurrenceRule();
        rule.second = request.updateIntervalSeconds ?? 10;
        return rule;
      }),
      () => this.getNextTask(),
      {
        ...request,
        playState: 'playing',
        sessionId,
      },
      { visible: false },
    );

    // Kick off leading edge task
    GlobalScheduler.scheduleOneOffTask(
      UpdatePlexPlayStatusTask.name,
      dayjs().add(1, 'second'),
      {
        ...request,
        playState: this.playState,
        sessionId: this.sessionId,
      },
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
      UpdatePlexPlayStatusTask.name,
      dayjs().add(5, 'seconds').toDate(),
      {
        ...this.request,
        playState: this.playState,
        sessionId: this.sessionId,
      },
      this.getNextTask(),
    );
  }

  private getNextTask(): UpdatePlexPlayStatusTask {
    const task = new UpdatePlexPlayStatusTask(
      this.mediaSourceApiFactory,
      this.plexServer,
    );

    this.request = {
      ...this.request,
      startTime: Math.min(
        this.request.startTime +
          (this.request.updateIntervalSeconds ?? 10) * 1000,
        this.request.duration,
      ),
    };

    return task;
  }
}

@injectable()
@taskDef({
  schema: UpdatePlexPlayStatusScheduleRequest,
  hidden: true,
})
class UpdatePlexPlayStatusTask extends Task2<
  typeof UpdatePlexPlayStatusTaskInvocation,
  boolean
> {
  public ID: string = UpdatePlexPlayStatusTask.name;
  schema = UpdatePlexPlayStatusTaskInvocation;

  get taskName(): string {
    return this.ID;
  }

  constructor(
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
    private plexServer: MediaSourceWithRelations,
  ) {
    super(
      LoggerFactory.child({
        className: UpdatePlexPlayStatusScheduledTask.name,
      }),
    );
  }

  protected async runInternal(
    request: UpdatePlexPlayStatusTaskInvocation,
  ): Promise<boolean> {
    const plex =
      await this.mediaSourceApiFactory.getPlexApiClientForMediaSource(
        this.plexServer,
      );

    const deviceName = `tunarr-channel-${request.channelNumber}`;
    const params = {
      ...StaticPlexHeaders,
      ratingKey: request.ratingKey,
      state: request.playState,
      key: `/library/metadata/${request.ratingKey}`,
      time: request.startTime,
      duration: request.duration,
      'X-Plex-Product': 'Tunarr',
      'X-Plex-Version': getTunarrVersion(),
      'X-Plex-Device-Name': deviceName,
      'X-Plex-Device': deviceName,
      'X-Plex-Client-Identifier': PlexClientIdentifier,
    };

    try {
      await plex.doPost({ url: '/:/timeline', params });
    } catch (error) {
      this.logger.warn(
        error,
        `Problem updating Plex status using status URL for item ${request.ratingKey}: `,
      );
      return false;
    }

    return true;
  }
}
