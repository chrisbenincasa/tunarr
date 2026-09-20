import path from 'node:path';
import type { ISettingsDB } from '../../db/interfaces/ISettingsDB.ts';
import type { ChannelOrmWithTranscodeConfig } from '../../db/schema/derivedTypes.ts';
import { serverOptions } from '../../globals.ts';
import type { FeatureFlagService } from '../../services/FeatureFlagService.ts';
import { Result } from '../../types/result.ts';
import type { ChildProcessWrapper } from '../../util/ChildProcessHelper.ts';
import type { ChildProcessHelper } from '../../util/ChildProcessHelper.ts';
import { isNonEmptyString } from '../../util/index.ts';
import { defaultHlsOptions } from '../../ffmpeg/builder/constants.ts';
import type { SessionOptions } from '../Session.ts';
import { Session } from '../Session.ts';
import type { EtvNextBinaryResolver } from './EtvNextBinaryResolver.ts';
import { toChannelConfig } from './EtvNextChannelConfigMapper.ts';
import { createMultivariantPlaylist } from './EtvNextPlaylistCreator.ts';
import type { EtvNextPlayoutWriter } from './EtvNextPlayoutWriter.ts';
import { DefaultWindowMs } from './EtvNextPlayoutWriter.ts';
import { DefaultStalenessMs, EtvNextWorkspace } from './EtvNextWorkspace.ts';

export type EtvNextSessionOptions = SessionOptions & {
  transcodeDirectory?: string;

  /** How far ahead to materialize. Lowered to one item by the troubleshoot path. */
  windowMs?: number;
};

export type EtvNextSessionProvider = (
  channel: ChannelOrmWithTranscodeConfig,
  options: EtvNextSessionOptions,
) => EtvNextSession;

/**
 * A channel streamed by an `ersatztv-channel` worker instead of by Tunarr's
 * own ffmpeg pipeline.
 *
 * This extends `Session` rather than `BaseHlsSession`, even though it serves
 * HLS. `BaseHlsSession` exists to drive Tunarr's ffmpeg pipeline — its
 * `getHlsOptions()` describes arguments for a transcode this session never
 * runs, and its readiness check counts `data%06d.ts` segments beside a
 * `stream.m3u8` that the worker does not write. Implementing those to satisfy
 * the base class would mean fabricating an options object nothing reads.
 * Everything actually shared — connection tracking, the state machine,
 * heartbeats, staleness and scheduled cleanup — lives on `Session`.
 *
 * Tunarr owns the process lifetime, so no ErsatzTV server is involved. See the
 * integration plan's §3 for why the sidecar shape was rejected.
 */
export class EtvNextSession extends Session<EtvNextSessionOptions> {
  public readonly sessionType = 'etv_next' as const;

  #workspace: EtvNextWorkspace;
  #process?: ChildProcessWrapper;
  #ignoredSettings: string[] = [];

  constructor(
    channel: ChannelOrmWithTranscodeConfig,
    options: EtvNextSessionOptions,
    private binaryResolver: EtvNextBinaryResolver,
    private playoutWriter: EtvNextPlayoutWriter,
    private childProcessHelper: ChildProcessHelper,
    private settingsDB: ISettingsDB,
    private featureFlagService: FeatureFlagService,
  ) {
    super(channel, {
      // Tunarr's global default is longer than the worker's own reap window,
      // which would let the file clock end sessions first.
      stalenessMs: DefaultStalenessMs,
      ...options,
    });

    this.#workspace = new EtvNextWorkspace(
      this.baseDirectory,
      this.channel.uuid,
    );
  }

  get baseDirectory() {
    const { transcodeDirectory } = this.sessionOptions;
    return isNonEmptyString(transcodeDirectory)
      ? transcodeDirectory
      : path.join(
          serverOptions().databaseDirectory,
          defaultHlsOptions.segmentBaseDirectory,
        );
  }

  get workspace() {
    return this.#workspace;
  }

  get workingDirectory() {
    return this.#workspace.outputDirectory;
  }

  get serverPath() {
    return `/stream/channels/${this.channel.uuid}.m3u8`;
  }

  /** Settings that did not survive the crossing into the worker's config. */
  get ignoredSettings(): readonly string[] {
    return this.#ignoredSettings;
  }

  protected async startInternal(): Promise<void> {
    const executablePath = await this.binaryResolver.resolveChecked();

    await this.#workspace.initialize();

    const { config, ignored } = toChannelConfig({
      transcodeConfig: this.channel.transcodeConfig,
      ffmpegSettings: this.settingsDB.ffmpegSettings(),
      playoutFolder: this.#workspace.playoutDirectory,
    });
    await this.#workspace.writeChannelConfig(config);

    const startMs = Date.now();
    const window = await this.playoutWriter.materializeWindow({
      channel: this.channel,
      startMs,
      windowMs: this.sessionOptions.windowMs ?? DefaultWindowMs,
    });

    if (window.items.length === 0) {
      throw new Error(
        `Channel ${this.channel.uuid} produced no playable items; refusing to start a worker that would only show black`,
      );
    }

    await this.#workspace.writePlayoutWindow(
      window.startMs,
      window.finishMs,
      window.items,
    );

    this.#ignoredSettings = [
      ...ignored.map((i) => `${i.field}: ${i.reason}`),
      ...window.ignored,
    ];
    if (this.#ignoredSettings.length > 0) {
      this.logger.info(
        'Some settings do not map onto the ErsatzTV next backend: %s',
        this.#ignoredSettings.join('; '),
      );
    }

    // The worker reaps itself on a stale heartbeat, so the file has to exist
    // before it starts counting.
    await this.#workspace.recordHeartbeat();

    this.#process = await this.childProcessHelper.spawn(
      executablePath,
      [
        'run',
        this.#workspace.channelConfigPath,
        '--output-folder',
        this.#workspace.outputDirectory,
        '--number',
        `${this.channel.number}`,
      ],
      {
        name: `etv-next-${this.channel.uuid}`,

        // An idle reap exits zero and is not a failure, and a genuine crash
        // should surface as a dead session rather than a restart loop against
        // a config that will fail again the same way.
        restartOnFailure: false,
        maxAttempts: 1,
      },
    );
  }

  protected override async waitForStreamReady(): Promise<Result<void>> {
    return Result.attemptAsync(() =>
      this.#workspace.waitForReady(() => this.#isProcessAlive()),
    );
  }

  protected async stopInternal(): Promise<void> {
    this.#process?.kill();
    this.#process = undefined;

    await this.#workspace.cleanup().catch((e: unknown) => {
      this.logger.warn(e, 'Could not clean up the ErsatzTV next workspace');
    });
  }

  /**
   * Records a client heartbeat.
   *
   * Two clocks have to be fed. Tunarr's tracker decides when the session is
   * idle; the worker's `.heartbeat` file stops it reaping itself underneath a
   * session Tunarr still considers live.
   */
  override recordHeartbeat(token: string) {
    super.recordHeartbeat(token);
    this.#workspace.recordHeartbeat().catch((e: unknown) => {
      this.logger.warn(e, 'Could not touch the ErsatzTV next heartbeat file');
    });
  }

  /**
   * The multivariant playlist clients are handed.
   *
   * The worker writes a media playlist only; upstream's server synthesizes
   * this wrapper at request time and Tunarr does not run that server.
   */
  getMasterPlaylist(): string {
    const { transcodeConfig } = this.channel;

    return createMultivariantPlaylist({
      streamBaseUrl: `/stream/channels/${this.channel.uuid}/${this.sessionType}/`,
      videoBitrateKbps: transcodeConfig.videoBitRate,
      audioBitrateKbps: transcodeConfig.audioBitRate,
      includeSubtitles: this.featureFlagService.get('webvttSidecarEnabled'),
    });
  }

  #isProcessAlive(): boolean {
    const underlying = this.#process?.process;
    return underlying !== undefined && underlying.exitCode === null;
  }
}
