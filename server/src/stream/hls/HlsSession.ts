import dayjs, { Dayjs } from 'dayjs';
import ld, { isEmpty } from 'lodash-es';
import fs from 'node:fs/promises';
import path, { extname } from 'node:path';
import { ChannelDB } from '../../dao/channelDb';
import { Channel } from '../../dao/direct/derivedTypes';
import { getSettings } from '../../dao/settings';
import { FfmpegTranscodeSession } from '../../ffmpeg/FfmpegTrancodeSession';
import { GetLastPtsDurationTask } from '../../ffmpeg/GetLastPtsDuration';
import { HlsOutputFormat } from '../../ffmpeg/OutputFormat';
import { serverContext } from '../../serverContext';
import { OnDemandChannelService } from '../../services/OnDemandChannelService';
import { Result } from '../../types/result';
import { Maybe } from '../../types/util';
import { wait } from '../../util';
import { fileExists } from '../../util/fsUtil';
import { PlayerContext } from '../PlayerStreamContext';
import { ProgramStreamFactory } from '../ProgramStreamFactory';
import { StreamProgramCalculator } from '../StreamProgramCalculator';
import { BaseHlsSession, BaseHlsSessionOptions } from './BaseHlsSession';
import { HlsPlaylistMutator } from './HlsPlaylistMutator';

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

        const programStream = ProgramStreamFactory.create(
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

        const transcodeSession = await programStream.setup({
          ptsOffset,
        });

        this.transcodedUntil = this.transcodedUntil.add(
          transcodeSession.streamDuration,
        );

        return programStream;
      },
    );

    // TODO: handle failure
    await programStreamResult.mapAsync(async (programStream) => {
      await this.trimPlaylistAndDeleteSegments();
      this.#currentSession = await programStream.setup();
      await programStream.start();
      return programStream.transcodeSession.wait();
    });

    this.logger.debug('Stream ended. ');
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

    const p = ld
      .chain(workingDirectoryFiles.get())
      .filter((f) => extname(f) === '.ts' || extname(f) === '.mp4')
      .sort()
      .last()
      .value();

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
          this.logger.debug('Skipping trim after short segment');
          return;
        }

        const trimResult =
          this.#hlsPlaylistMutator.trimPlaylistWithDiscontinuity(
            this.#playlistStart,
            dayjs().subtract(1, 'minute'),
            playlistLines,
          );

        this.logger.debug('writing playlist \n', trimResult.playlist);

        await fs.writeFile(this._m3u8PlaylistPath, trimResult.playlist);

        this.logger.debug('Deleting old segments from stream');
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
    const segments = ld
      .chain(workingDirectoryFiles)
      .filter((f) => {
        const ext = extname(f);
        return ext === '.ts' || ext === '.mp4';
      })
      .map((file) => {
        const matches = file.match(/[A-z/]+(\d+)\.[ts|mp4]/);
        if (matches && matches.length > 0) {
          return {
            file,
            seq: parseInt(matches[1]),
          };
        }
        return;
      })
      .compact()
      .filter(({ seq }) => seq < sequenceNum)
      .value();

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
