import { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import { ChannelWithTranscodeConfig } from '@/db/schema/derivedTypes.js';
import { FfmpegTranscodeSession } from '@/ffmpeg/FfmpegTrancodeSession.js';
import { GetLastPtsDurationTask } from '@/ffmpeg/GetLastPtsDuration.js';
import { HlsOutputFormat, OutputFormat } from '@/ffmpeg/builder/constants.js';
import { OnDemandChannelService } from '@/services/OnDemandChannelService.js';
import { PlayerContext } from '@/stream/PlayerStreamContext.js';
import { ProgramStream } from '@/stream/ProgramStream.js';
import { StreamProgramCalculator } from '@/stream/StreamProgramCalculator.js';
import {
  HlsSlowerSession,
  HlsSlowerSessionOptions,
} from '@/stream/hls/HlsSlowerSession.js';
import { Result } from '@/types/result.js';
import { Maybe } from '@/types/util.js';
import { fileExists } from '@/util/fsUtil.js';
import { wait } from '@/util/index.js';
import { seq } from '@tunarr/shared/util';
import dayjs, { Dayjs } from 'dayjs';
import { interfaces } from 'inversify';
import { filter, isEmpty, last, sortBy } from 'lodash-es';
import fs from 'node:fs/promises';
import path, { extname } from 'node:path';
import { BaseHlsSession, BaseHlsSessionOptions } from './BaseHlsSession.js';
import { HlsPlaylistMutator } from './HlsPlaylistMutator.js';

export type HlsSessionProvider = (
  channel: ChannelWithTranscodeConfig,
  options: HlsSessionOptions,
) => HlsSession;

export type HlsSlowerSessionProvider = (
  channel: ChannelWithTranscodeConfig,
  options: HlsSlowerSessionOptions,
) => HlsSlowerSession;

/**
 * Initializes an ffmpeg process that concatenates via the /playlist
 * endpoint and outputs an HLS format + segments
 */
export class HlsSession extends BaseHlsSession<HlsSessionOptions> {
  public readonly sessionType = 'hls' as const;
  #playlistStart: Dayjs;
  #hlsPlaylistMutator: HlsPlaylistMutator = new HlsPlaylistMutator();
  #currentSession: Maybe<FfmpegTranscodeSession>;
  #lastDelete: Dayjs = dayjs().subtract(1, 'year');

  constructor(
    channel: ChannelWithTranscodeConfig,
    options: HlsSessionOptions,
    private programCalculator: StreamProgramCalculator,
    private settingsDB: ISettingsDB,
    private onDemandService: OnDemandChannelService,
    private programStreamFactory: interfaces.SimpleFactory<
      ProgramStream,
      [PlayerContext, OutputFormat]
    >,
  ) {
    super(channel, options);
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

    const lineupItemResult = await this.programCalculator.getCurrentLineupItem({
      allowSkip: true,
      channelId: this.channel.uuid,
      startTime: await this.onDemandService.getLiveTimestamp(
        this.channel.uuid,
        +this.transcodedUntil,
      ),
    });

    const transcodeResult = await lineupItemResult.mapAsync(async (result) => {
      this.logger.debug(
        'About to play lineup item: %s',
        JSON.stringify(result.lineupItem, undefined, 4),
      );
      const context = new PlayerContext(
        result.lineupItem,
        result.channelContext,
        result.sourceChannel,
        false,
        result.lineupItem.type === 'loading',
        realtime,
        this.sessionOptions.useNewPipeline ??
          this.settingsDB.ffmpegSettings().useNewFfmpegPipeline,
        this.channel.transcodeConfig,
        this.sessionType,
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
            this.channel,
            realtime,
            this.sessionOptions.useNewPipeline ??
              this.settingsDB.ffmpegSettings().useNewFfmpegPipeline,
            this.channel.transcodeConfig,
            this.sessionType,
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

      await this.trimPlaylistAndDeleteSegments();
      await programStream.start();
      return programStream.transcodeSession.wait();
    });

    if (transcodeResult.isFailure()) {
      this.logger.error(
        transcodeResult.error,
        'Error while transcoding program stream.',
      );
    }

    this.logger.debug('Stream ended.');
  }

  private getProgramStream(context: PlayerContext) {
    return this.programStreamFactory(
      context,
      HlsOutputFormat({
        hlsDeleteThreshold: 3,
        streamNameFormat: 'stream.m3u8',
        segmentNameFormat: 'data%06d.ts',
        streamBasePath: `stream_${this.channel.uuid}`,
        streamBaseUrl: `/stream/channels/${this.channel.uuid}/${this.sessionType}/`,
        hlsTime: 4,
        hlsListSize: 0,
        deleteThreshold: null,
        appendSegments: true,
      }),
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
