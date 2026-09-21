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
import {
  createDynamicPlaceholder,
  DynamicRollCheckIntervalMs,
  DynamicRollThresholdMs,
  DynamicTokenEnvVar,
  DynamicWindowMs,
  dynamicResolverUri,
} from './EtvNextDynamicPlayout.ts';
import type { EtvNextDynamicTokenRegistry } from './EtvNextDynamicTokenRegistry.ts';
import { StreamTerminationRequestedError } from './EtvNextPlayoutItemMapper.ts';
import { createMultivariantPlaylist } from './EtvNextPlaylistCreator.ts';
import type { EtvNextPlayoutWriter } from './EtvNextPlayoutWriter.ts';
import { DefaultWindowMs } from './EtvNextPlayoutWriter.ts';
import { DefaultStalenessMs, EtvNextWorkspace } from './EtvNextWorkspace.ts';
import type { PlayoutItem } from './generated/playout.ts';

/**
 * How often the window is rebuilt, as a fraction of its length.
 *
 * This sets how long a programming edit takes to reach a running stream, and
 * it has to stay well under the window itself so three rebuilds can fail
 * before the worker reaches the end of what it holds.
 */
const RefreshFraction = 0.25;

/** A floor on the rebuild cadence, so a very short window cannot spin. */
const MinRefreshIntervalMs = 60_000;

export type EtvNextSessionOptions = SessionOptions & {
  transcodeDirectory?: string;

  /**
   * How the worker learns what to play.
   *
   * `dynamic` writes one placeholder the worker resolves against Tunarr for
   * every item, so a programming edit lands at the next item. `materialized`
   * writes the schedule out ahead of time, which is what a diagnostic
   * transcode wants and what the channel falls back to.
   */
  playoutMode?: EtvNextPlayoutMode;

  /**
   * The port the worker calls Tunarr back on. Defaults to the port Tunarr
   * listens on.
   */
  tunarrPort?: number;

  /**
   * How far ahead the schedule stays materialized.
   *
   * A standing lead rather than a one-time depth — the window is rebuilt on a
   * timer. Raising it commits the worker further ahead to a schedule Tunarr
   * may since have changed, and makes each rebuild cost more.
   */
  windowMs?: number;
};

export type EtvNextPlayoutMode = 'dynamic' | 'materialized';

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

  #windowItems: PlayoutItem[] = [];
  #itemsEmitted = 0;
  #dynamicWindowFinishMs?: number;
  #refreshTimer?: NodeJS.Timeout;
  #refreshing = false;
  #stopping = false;

  /**
   * The window write currently running, so teardown can wait it out.
   *
   * A write racing `cleanup()` otherwise fails on a directory that is already
   * gone and logs it as a window that could not be rolled.
   */
  #inFlightWindowWrite?: Promise<unknown>;

  constructor(
    channel: ChannelOrmWithTranscodeConfig,
    options: EtvNextSessionOptions,
    private binaryResolver: EtvNextBinaryResolver,
    private playoutWriter: EtvNextPlayoutWriter,
    private childProcessHelper: ChildProcessHelper,
    private settingsDB: ISettingsDB,
    private featureFlagService: FeatureFlagService,
    private tokenRegistry: EtvNextDynamicTokenRegistry,
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

    this.#stopping = false;
    this.#ignoredSettings = [];

    await this.#workspace.initialize();

    const { config, ignored } = toChannelConfig({
      transcodeConfig: this.channel.transcodeConfig,
      ffmpegSettings: this.settingsDB.ffmpegSettings(),
      playoutFolder: this.#workspace.playoutDirectory,
    });
    await this.#workspace.writeChannelConfig(config);

    this.#recordIgnored(ignored.map((i) => `${i.field}: ${i.reason}`));

    try {
      const workerEnv = await this.#writeInitialPlayout();

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
        workerEnv,
      );
    } catch (e) {
      // A token outliving the worker it was minted for would keep granting
      // this channel's programming to nothing.
      this.tokenRegistry.revoke(this.channel.uuid);
      throw e;
    }

    this.#process.process?.once('exit', (code, signal) =>
      this.#onWorkerExit(code, signal),
    );

    this.#startWindowRefresh();
  }

  /**
   * Writes the playout the worker starts against, and the environment it needs
   * to read it.
   *
   * The dynamic placeholder carries no secret itself. The worker expands
   * `{{TUNARR_ETV_TOKEN}}` from its own environment when it builds the
   * request, so the token never lands in a file.
   */
  async #writeInitialPlayout(): Promise<NodeJS.ProcessEnv | undefined> {
    if (this.#playoutMode === 'dynamic') {
      const token = this.tokenRegistry.issue(
        this.channel.uuid,
        this.channel.number,
      );

      await this.#writeDynamicWindow(Date.now());

      return { ...process.env, [DynamicTokenEnvVar]: token };
    }

    const window = await this.playoutWriter.materializeWindow({
      channel: this.channel,
      startMs: Date.now(),
      windowMs: this.#windowMs,
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

    this.#windowItems = window.items;
    this.#itemsEmitted = window.items.length;
    this.#recordIgnored(window.ignored);

    return undefined;
  }

  /** Replaces the window with one placeholder covering the next 12 hours. */
  async #writeDynamicWindow(startMs: number): Promise<void> {
    const finishMs = startMs + DynamicWindowMs;

    await this.#workspace.writePlayoutWindow(startMs, finishMs, [
      createDynamicPlaceholder({
        channelUuid: this.channel.uuid,
        startMs,
        finishMs,
        resolverUri: dynamicResolverUri(this.#tunarrPort),
      }),
    ]);

    this.#dynamicWindowFinishMs = finishMs;
  }

  protected override async waitForStreamReady(): Promise<Result<void>> {
    return Result.attemptAsync(() =>
      this.#workspace.waitForReady(() => this.#isProcessAlive()),
    );
  }

  protected async stopInternal(): Promise<void> {
    // Set before the kill so the exit listener knows this one was deliberate.
    this.#stopping = true;
    this.#stopWindowRefresh();

    // The token dies with the session, so a worker that outlives its kill
    // cannot keep resolving items.
    this.tokenRegistry.revoke(this.channel.uuid);

    // Let a write that is already running finish before the directory goes.
    await this.#inFlightWindowWrite?.catch(() => undefined);

    try {
      this.#process?.kill();
      this.#process = undefined;

      await this.#workspace.cleanup();
    } catch (e) {
      this.logger.warn(e, 'Could not clean up the ErsatzTV next workspace');
    } finally {
      this.#windowItems = [];
      this.state = 'stopped';
      this.emit('stop');
    }
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

  get #windowMs(): number {
    return this.sessionOptions.windowMs ?? DefaultWindowMs;
  }

  get #playoutMode(): EtvNextPlayoutMode {
    return this.sessionOptions.playoutMode ?? 'dynamic';
  }

  get #tunarrPort(): number {
    return this.sessionOptions.tunarrPort ?? serverOptions().port;
  }

  /**
   * Ends the session when the worker goes away on its own.
   *
   * Nothing else would notice. The output directory keeps its last segments,
   * so clients would poll a playlist that never advances, and those very polls
   * keep the connection tracker from ever calling the session idle. Stopping
   * emits `stop`, which drops the session from the manager's map, so the next
   * viewer gets a fresh worker rather than a frozen one.
   */
  #onWorkerExit(code: number | null, signal: NodeJS.Signals | null): void {
    if (this.#stopping || this.state === 'stopped') {
      return;
    }

    this.logger.warn(
      'The ErsatzTV next worker exited on its own (code = %s, signal = %s). Ending the session.',
      code ?? 'none',
      signal ?? 'none',
    );

    this.stop().catch((e: unknown) => {
      this.logger.error(
        e,
        'Could not stop the session after the worker exited',
      );
    });
  }

  #startWindowRefresh(): void {
    const dynamic = this.#playoutMode === 'dynamic';
    const intervalMs = dynamic
      ? DynamicRollCheckIntervalMs
      : Math.max(
          MinRefreshIntervalMs,
          Math.floor(this.#windowMs * RefreshFraction),
        );

    this.#refreshTimer = setInterval(() => {
      void (dynamic ? this.rollDynamicWindow() : this.refreshWindow());
    }, intervalMs);

    // A pending refresh must not hold the event loop open at shutdown.
    this.#refreshTimer.unref();
  }

  #stopWindowRefresh(): void {
    if (this.#refreshTimer !== undefined) {
      clearInterval(this.#refreshTimer);
      this.#refreshTimer = undefined;
    }
  }

  /**
   * Moves the dynamic placeholder forward before it runs out.
   *
   * The worker clamps every resolved item's `finish` to the placeholder's, so
   * a window nearing its end starts truncating programs, and past it the
   * channel goes black. Rolling early leaves the whole threshold's worth of
   * attempts to succeed in.
   *
   * Driven by the refresh timer, and by tests directly.
   */
  private async rollDynamicWindow(): Promise<void> {
    const finishMs = this.#dynamicWindowFinishMs;

    // `#stopping` is raised before teardown starts; `state` only afterwards.
    if (
      this.#refreshing ||
      this.#stopping ||
      this.state !== 'started' ||
      finishMs === undefined
    ) {
      return;
    }

    const nowMs = Date.now();
    if (finishMs - nowMs > DynamicRollThresholdMs) {
      return;
    }

    this.#refreshing = true;
    try {
      this.#inFlightWindowWrite = this.#writeDynamicWindow(nowMs);
      await this.#inFlightWindowWrite;
    } catch (e) {
      // Upstream degrades a missing window to black and logs nothing, so this
      // is the only warning anyone gets.
      this.logger.error(
        e,
        'Could not roll the ErsatzTV next playout window for channel %s. The channel goes black at %s unless a later attempt succeeds.',
        this.channel.uuid,
        new Date(finishMs).toISOString(),
      );
    } finally {
      this.#inFlightWindowWrite = undefined;
      this.#refreshing = false;
    }
  }

  /**
   * Rebuilds the playout window from the currently-playing item forward.
   *
   * The worker plays what the single window file covers and shows black past
   * its finish, so a session outliving one window would go dark. Appending to
   * the window would cover that, but it can never correct what it already
   * wrote — a programming edit reaches Tunarr's own pipeline at the next
   * program, and the worker would keep playing the superseded schedule until
   * the materialized items ran out. So the unplayed tail is rebuilt instead.
   *
   * The playing item is carried over untouched. Its id has to stay stable or
   * the worker treats it as a new item and restarts it mid-program, and
   * rebuilding from its finish means no seam is introduced at the join.
   *
   * Driven by the refresh timer, and by tests directly.
   */
  private async refreshWindow(): Promise<void> {
    // `#stopping` is raised before teardown starts; `state` only afterwards.
    if (this.#refreshing || this.#stopping || this.state !== 'started') {
      return;
    }

    this.#refreshing = true;
    try {
      const nowMs = Date.now();
      const playing = this.#windowItems.find(
        (item) =>
          Date.parse(item.start) <= nowMs && Date.parse(item.finish) > nowMs,
      );
      const rebuildFromMs =
        playing !== undefined ? Date.parse(playing.finish) : nowMs;
      const targetFinishMs = nowMs + this.#windowMs;

      // A program longer than the window covers the lead on its own. There is
      // no tail to rebuild until it ends.
      if (rebuildFromMs >= targetFinishMs) {
        return;
      }

      const window = await this.playoutWriter.materializeWindow({
        channel: this.channel,
        startMs: rebuildFromMs,
        windowMs: targetFinishMs - rebuildFromMs,
        idSeed: this.#itemsEmitted,
      });

      if (window.items.length === 0) {
        this.logger.warn(
          'The schedule produced nothing past %d; channel %s will go dark when its window ends',
          rebuildFromMs,
          this.channel.uuid,
        );
        return;
      }

      const items =
        playing !== undefined ? [playing, ...window.items] : window.items;

      this.#inFlightWindowWrite = this.#workspace.writePlayoutWindow(
        playing !== undefined ? Date.parse(playing.start) : window.startMs,
        window.finishMs,
        items,
      );
      await this.#inFlightWindowWrite;

      this.#windowItems = items;

      // Never reused, so a rebuilt item cannot collide with the carried-over
      // playing item.
      this.#itemsEmitted += window.items.length;
      this.#recordIgnored(window.ignored);
    } catch (e) {
      if (e instanceof StreamTerminationRequestedError) {
        // The channel's error screen is 'kill', which asks for the stream to
        // end rather than for a picture.
        this.logger.error(
          'Channel %s asked for its stream to end (%s). Stopping the worker.',
          this.channel.uuid,
          e.reason,
        );

        this.stop().catch((stopError: unknown) => {
          this.logger.error(
            stopError,
            'Could not stop the session after the channel asked for termination',
          );
        });

        return;
      }

      this.logger.error(
        e,
        'Could not rebuild the ErsatzTV next playout window',
      );
    } finally {
      this.#inFlightWindowWrite = undefined;
      this.#refreshing = false;
    }
  }

  /** Logs and keeps reasons not seen before, so a refresh cannot re-log a list. */
  #recordIgnored(reasons: readonly string[]): void {
    const fresh = reasons.filter(
      (reason) => !this.#ignoredSettings.includes(reason),
    );
    if (fresh.length === 0) {
      return;
    }

    this.#ignoredSettings = [...this.#ignoredSettings, ...fresh];
    this.logger.info(
      'Some settings do not map onto the ErsatzTV next backend: %s',
      fresh.join('; '),
    );
  }
}
