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
   * How far ahead the schedule stays materialized.
   *
   * A standing lead rather than a one-time depth — the window is rebuilt on a
   * timer. Raising it commits the worker further ahead to a schedule Tunarr
   * may since have changed, and makes each rebuild cost more.
   */
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

  #windowItems: PlayoutItem[] = [];
  #itemsEmitted = 0;
  #refreshTimer?: NodeJS.Timeout;
  #refreshing = false;
  #stopping = false;

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

    this.#process.process?.once('exit', (code, signal) =>
      this.#onWorkerExit(code, signal),
    );

    this.#startWindowRefresh();
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
    const intervalMs = Math.max(
      MinRefreshIntervalMs,
      Math.floor(this.#windowMs * RefreshFraction),
    );

    this.#refreshTimer = setInterval(() => {
      void this.refreshWindow();
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
    if (this.#refreshing || this.state !== 'started') {
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

      await this.#workspace.writePlayoutWindow(
        playing !== undefined ? Date.parse(playing.start) : window.startMs,
        window.finishMs,
        items,
      );

      this.#windowItems = items;

      // Never reused, so a rebuilt item cannot collide with the carried-over
      // playing item.
      this.#itemsEmitted += window.items.length;
      this.#recordIgnored(window.ignored);
    } catch (e) {
      this.logger.error(
        e,
        'Could not rebuild the ErsatzTV next playout window',
      );
    } finally {
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
