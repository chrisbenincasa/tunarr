import { RecurrenceRule } from 'node-schedule';
import { PlexServerSettings } from '../dao/entities/PlexServerSettings';
import { PlexApiFactory } from '../external/plex';
import { run } from '../util';
import { ScheduledTask } from './ScheduledTask';
import { Task } from './Task';
import dayjs from 'dayjs';
import { GlobalScheduler } from '../services/scheduler';
import { v4 } from 'uuid';

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
    private plexServer: PlexServerSettings,
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
    private plexServer: PlexServerSettings,
    private request: UpdatePlexPlayStatusInvocation,
  ) {
    super();
  }

  protected async runInternal(): Promise<boolean> {
    const plex = PlexApiFactory.get(this.plexServer);

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
      await plex.doPost('/:/timeline', params);
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
