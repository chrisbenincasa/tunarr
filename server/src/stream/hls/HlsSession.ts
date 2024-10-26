import { seq } from '@tunarr/shared/util';
import dayjs, { Dayjs } from 'dayjs';
import { filter, isEmpty, last, sortBy } from 'lodash-es';
import fs from 'node:fs/promises';
import path, { extname } from 'node:path';
import { ChannelDB } from '../../dao/channelDb.ts';
import { Channel } from '../../dao/direct/schema/Channel.ts';
import { getSettings } from '../../dao/settings.ts';
import { FfmpegTranscodeSession } from '../../ffmpeg/FfmpegTrancodeSession.ts';
import { GetLastPtsDurationTask } from '../../ffmpeg/GetLastPtsDuration.ts';
import { HlsOutputFormat } from '../../ffmpeg/OutputFormat.ts';
import { serverContext } from '../../serverContext.ts';
import { OnDemandChannelService } from '../../services/OnDemandChannelService.ts';
import { Result } from '../../types/result.ts';
import { Maybe } from '../../types/util.ts';
import { fileExists } from '../../util/fsUtil.ts';
import { wait } from '../../util/index.ts';
import { PlayerContext } from '../PlayerStreamContext.ts';
import { ProgramStreamFactory } from '../ProgramStreamFactory.ts';
import { StreamProgramCalculator } from '../StreamProgramCalculator.ts';
import { BaseHlsSession, BaseHlsSessionOptions } from './BaseHlsSession.ts';
import { HlsPlaylistMutator } from './HlsPlaylistMutator.ts';

/**
 * Initializes an ffmpeg process that concatenates via the /playlist
 * endpoint and outputs an HLS format + segments
 */
export class HlsSession extends BaseHlsSession<HlsSessionOptions> {
  public readonly sessionType = 'hls' as const;
  #playlistStart: Dayjs;
  #programCalculator: StreamProgramCalculator;
  #hlsPlaylistMutator: HlsPlaylistMutator = new HlsPlaylistMutator();
  #currentSession: Maybe<FfmpegTranscodeSession>;
  #lastDelete: Dayjs = dayjs().subtract(1, 'year');

  constructor(
    channel: Channel,
    options: HlsSessionOptions,
    programCalculator: StreamProgramCalculator = serverContext().streamProgramCalculator(),
    private settingsDB = getSettings(),
    private onDemandService: OnDemandChannelService = new OnDemandChannelService(
      new ChannelDB(),
    ),
  ) {
    super(channel, options);
    this.#programCalculator = programCalculator;
  }

  async trimPlaylist(filterBefore: Dayjs) {
    try {
      return await this.lock.runExclusive(async () => {
        const playlistLines = await this.readPlaylist();
        if (playlistLines) {
          const trimResult = this.#hlsPlaylistMutator.trimPlaylist(
            this.#playlistStart,
            filterBefore,
            playlistLines,
          );
          if (dayjs().isAfter(this.#lastDelete.add(30, 'seconds'))) {
            this.logger.debug('Deleting old segments from stream');
            this.deleteOldSegments(trimResult.sequence).catch((e) =>
              this.logger.error(e),
            );
            this.#lastDelete = dayjs();
          }
          return trimResult;
        }
        return;
      });
    } catch (e) {
      this.logger.error(e);
      return;
    }
  }

  protected async startInternal() {
    if (this.state === 'started') {
      return;
    }

    await this.initDirectories();

    this.state = 'started';
    this.#playlistStart = this.transcodedUntil = dayjs();
    // this.transcodedUntil = dayjs(
    //   await this.onDemandService.getLiveTimestamp(
    //     this.channel.uuid,
    //     +this.#playlistStart,
    //   ),
    // );

    // Fire-and-forget
    this.run().catch((e) => this.logger.error(e));
  }

  private async run() {
    while (this.state === 'started') {
      const transcodeBuffer = dayjs
        .duration(dayjs(this.transcodedUntil).diff())
        .asSeconds();

      if (transcodeBuffer <= 60) {
        const realtime = transcodeBuffer >= 30;
        await this.transcode(realtime);
      } else {
        // trim and delete
        await this.trimPlaylistAndDeleteSegments();
        await wait(dayjs.duration({ seconds: 5 }));
      }
    }

    this.logger.debug(
      'HLS worker ended main loop with state = %s. Scheduling cleanup',
      this.state,
    );

    this.scheduleCleanup();
  }

  protected async stopInternal(): Promise<void> {
    try {
      await this.stopStream();
    } catch (e) {
      this.logger.error(e, 'Error while shutting down session');
    } finally {
      this.state = 'stopped';
    }
  }

  private async transcode(realtime: boolean) {
    const ptsOffset = await this.getPtsOffset();

    const lineupItemResult = await this.#programCalculator.getCurrentLineupItem(
      {
        allowSkip: true,
        channelId: this.channel.uuid,
        startTime: await this.onDemandService.getLiveTimestamp(
          this.channel.uuid,
          +this.transcodedUntil,
        ),
      },
    );

    const programStreamResult = await lineupItemResult.mapAsync(
      async (result) => {
        const context = new PlayerContext(
          result.lineupItem,
          result.channelContext,
          false,
          result.lineupItem.type === 'loading',
          realtime,
        );

        let programStream = this.getProgramStream(context);

        programStream.on('error', () => {
          this.state = 'error';
          this.error = new Error(
            `Unrecoverable error in underlying FFMPEG process`,
          );
          this.emit('error', this.error);
        });

        let transcodeSessionResult = await programStream.setup({
          ptsOffset,
        });

        if (transcodeSessionResult.isFailure()) {
          this.logger.error(
            transcodeSessionResult.error,
            'Error while starting program stream. Attempting to subtitute with error stream',
          );

          programStream = this.getProgramStream(
            PlayerContext.error(
              result.lineupItem.streamDuration ?? result.lineupItem.duration,
              transcodeSessionResult.error,
              result.channelContext,
              realtime,
            ),
          );

          transcodeSessionResult = await programStream.setup();

          if (transcodeSessionResult.isFailure()) {
            this.state = 'error';
            this.error = transcodeSessionResult.error;
            this.emit('error', this.error);
          }
        }

        transcodeSessionResult.forEach((transcodeSession) => {
          this.transcodedUntil = this.transcodedUntil.add(
            transcodeSession.streamDuration,
          );
          this.#currentSession = transcodeSession;
        });

        return programStream;
      },
    );

    await programStreamResult.mapAsync(async (programStream) => {
      await this.trimPlaylistAndDeleteSegments();
      await programStream.start();
      return programStream.transcodeSession.wait();
    });

    this.logger.debug('Stream ended.');
  }

  private getProgramStream(context: PlayerContext) {
    return ProgramStreamFactory.create(
      context,
      HlsOutputFormat({
        streamBasePath: `stream_${this.channel.uuid}`,
        streamBaseUrl: `/stream/channels/${this.channel.uuid}/${this.sessionType}/`,
        hlsTime: 4,
        hlsListSize: 0,
        deleteThreshold: null,
        appendSegments: true,
      }),
      this.settingsDB,
    );
  }

  private async getPtsOffset() {
    const lastSegment = await this.getLastSegment();

    if (!lastSegment) {
      this.logger.warn('No last segment found');
      return 0;
    }

    const result = await new GetLastPtsDurationTask(this.settingsDB).run(
      lastSegment,
    );

    if (result.isFailure()) {
      this.logger.error(result.error);
      return 0;
    }

    const { pts, duration } = result.get();

    return pts + duration + 1;
  }

  private async getLastSegment() {
    const workingDirectoryFiles = await Result.attemptAsync(() =>
      fs.readdir(this._workingDirectory),
    );

    if (workingDirectoryFiles.isFailure()) {
      this.logger.error(workingDirectoryFiles.error);
      return;
    }

    if (workingDirectoryFiles.get().length === 0) {
      return;
    }

    const p = last(
      sortBy(
        filter(
          workingDirectoryFiles.get(),
          (f) => extname(f) === '.ts' || extname(f) === '.mp4',
        ),
      ),
    );

    if (p) {
      return path.join(this._workingDirectory, p);
    }

    return;
  }

  isStale(): boolean {
    const remainingConnections = this.removeStaleConnections();
    return isEmpty(remainingConnections);
  }

  private async trimPlaylistAndDeleteSegments() {
    try {
      const playlistLines = await this.readPlaylist();
      if (playlistLines) {
        const dur = dayjs.duration(this.#playlistStart.diff(dayjs()));
        if (dur.asSeconds() <= 60) {
          this.logger.trace(
            'Skipping trim. %d seconds since last',
            dur.asSeconds(),
          );
          return;
        }

        const trimResult =
          this.#hlsPlaylistMutator.trimPlaylistWithDiscontinuity(
            this.#playlistStart,
            dayjs().subtract(1, 'minute'),
            playlistLines,
          );

        this.logger.trace('writing playlist\n%O', trimResult.playlist);

        await fs.writeFile(this._m3u8PlaylistPath, trimResult.playlist);

        this.logger.trace('Deleting old segments from stream');
        this.deleteOldSegments(trimResult.sequence).catch((e) => {
          this.logger.error(e);
        });

        this.#playlistStart = trimResult.playlistStart;
      }

      return;
    } catch (e) {
      this.logger.error(e);
    }
  }

  private async readPlaylist() {
    if (await fileExists(this._m3u8PlaylistPath)) {
      const playlistContents = await fs.readFile(this._m3u8PlaylistPath, {
        encoding: 'utf-8',
      });
      return playlistContents.toString().split('\n');
    }
    return;
  }

  private async deleteOldSegments(sequenceNum: number) {
    const workingDirectoryFiles = await fs.readdir(this._workingDirectory);
    const segments = filter(
      seq.collect(
        filter(workingDirectoryFiles, (f) => {
          const ext = extname(f);
          return ext === '.ts' || ext === '.mp4';
        }),
        (file) => {
          const matches = file.match(/[A-z/]+(\d+)\.[ts|mp4]/);
          if (matches && matches.length > 0) {
            return {
              file,
              seq: parseInt(matches[1]),
            };
          }
          return;
        },
      ),
      ({ seq }) => seq < sequenceNum,
    );

    for (const { file } of segments) {
      try {
        await fs.unlink(path.join(this._workingDirectory, file));
      } catch (e) {
        this.logger.error(e);
      }
    }
  }

  protected async stopStream(): Promise<void> {
    if (this.#currentSession) {
      this.#currentSession.kill();
    }

    this.logger.debug(
      `Cleaning out stream path for session: %s`,
      this._workingDirectory,
    );

    return await this.cleanupDirectory();
  }
}
export type HlsSessionOptions = BaseHlsSessionOptions & {
  sessionType: 'hls';
};
