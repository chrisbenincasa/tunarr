import type { MediaSourceOrm } from '@/db/schema/MediaSource.js';
import { GlobalScheduler } from '@/services/Scheduler.js';
import { ScheduledTask } from '@/tasks/ScheduledTask.js';
import { Task } from '@/tasks/Task.js';
import { run } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { getTunarrVersion } from '@/util/version.js';
import { PlexClientIdentifier } from '@tunarr/shared/constants';
import dayjs from 'dayjs';
import { injectable } from 'inversify';
import { RecurrenceRule } from 'node-schedule';
import { MediaSourceWithRelations } from '../../db/schema/derivedTypes.js';
import type { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';

export type UpdatePlexPlayStatusScheduleRequest = {
  ratingKey: string;
  startTime: number;
  duration: number;
  channelNumber: number;
  updateIntervalSeconds?: number;
};

type UpdatePlexPlayStatusInvocation = UpdatePlexPlayStatusScheduleRequest & {
  playState: PlayState;
  sessionId: string;
};

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
export class UpdatePlexPlayStatusScheduledTask extends ScheduledTask {
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
      [],
      { visible: false },
    );

    // Kick off leading edge task
    GlobalScheduler.scheduleOneOffTask(
      UpdatePlexPlayStatusTask.name,
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
      UpdatePlexPlayStatusTask.name,
      dayjs().add(5, 'seconds').toDate(),
      [],
      this.getNextTask(),
    );
  }

  private getNextTask(): UpdatePlexPlayStatusTask {
    const task = new UpdatePlexPlayStatusTask(
      this.mediaSourceApiFactory,
      this.plexServer,
      {
        ...this.request,
        playState: this.playState,
        sessionId: this.sessionId,
      },
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

class UpdatePlexPlayStatusTask extends Task {
  public ID: string = UpdatePlexPlayStatusTask.name;

  get taskName(): string {
    return this.ID;
  }

  constructor(
    private mediaSourceApiFactory: MediaSourceApiFactory,
    private plexServer: MediaSourceWithRelations,
    private request: UpdatePlexPlayStatusInvocation,
  ) {
    super(
      LoggerFactory.child({
        className: UpdatePlexPlayStatusScheduledTask.name,
      }),
    );
  }

  protected async runInternal(): Promise<boolean> {
    const plex =
      await this.mediaSourceApiFactory.getPlexApiClientForMediaSource(
        this.plexServer,
      );

    const deviceName = `tunarr-channel-${this.request.channelNumber}`;
    const params = {
      ...StaticPlexHeaders,
      ratingKey: this.request.ratingKey,
      state: this.request.playState,
      key: `/library/metadata/${this.request.ratingKey}`,
      time: this.request.startTime,
      duration: this.request.duration,
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
        `Problem updating Plex status using status URL for item ${this.request.ratingKey}: `,
      );
      return false;
    }

    return true;
  }
}
