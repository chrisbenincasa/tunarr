import dayjs from 'dayjs';
import { RecurrenceRule } from 'node-schedule';
import { v4 } from 'uuid';
import { MediaSource } from '../../dao/direct/derivedTypes';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory';
import { GlobalScheduler } from '../../services/scheduler';
import { run } from '../../util';
import { ScheduledTask } from '../ScheduledTask';
import { Task } from '../Task';

type UpdatePlexPlayStatusScheduleRequest = {
  ratingKey: string;
  startTime: number;
  duration: number;
  channelNumber: number;
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

export class UpdatePlexPlayStatusScheduledTask extends ScheduledTask {
  private playState: PlayState = 'playing';

  constructor(
    private plexServer: MediaSource,
    private request: UpdatePlexPlayStatusScheduleRequest,
    public sessionId: string = v4(),
  ) {
    super(
      UpdatePlexPlayStatusScheduledTask.name,
      run(() => {
        const rule = new RecurrenceRule();
        rule.second = 30;
        return rule;
      }),
      () => this.getNextTask(),
      { visible: false },
    );
    // Kick off leading edge task
    GlobalScheduler.scheduleOneOffTask(
      UpdatePlexPlayStatusTask.name,
      dayjs().add(1, 'second'),
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
      dayjs().add(30, 'seconds').toDate(),
      this.getNextTask(),
    );
  }

  private getNextTask(): UpdatePlexPlayStatusTask {
    const task = new UpdatePlexPlayStatusTask(this.plexServer, {
      ...this.request,
      playState: this.playState,
      sessionId: this.sessionId,
    });

    this.request = {
      ...this.request,
      startTime: Math.min(
        this.request.startTime + 30000,
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
    private plexServer: MediaSource,
    private request: UpdatePlexPlayStatusInvocation,
  ) {
    super();
  }

  protected async runInternal(): Promise<boolean> {
    const plex = MediaSourceApiFactory().get(this.plexServer);

    const deviceName = `tunarr-channel-${this.request.channelNumber}`;
    const params = {
      ...StaticPlexHeaders,
      ratingKey: this.request.ratingKey,
      state: this.request.playState,
      key: `/library/metadata/${this.request.ratingKey}`,
      time: this.request.startTime,
      duration: this.request.duration,
      'X-Plex-Device-Name': deviceName,
      'X-Plex-Device': deviceName,
      'X-Plex-Client-Identifier': this.request.sessionId,
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
