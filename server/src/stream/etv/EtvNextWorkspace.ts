import fs from 'node:fs/promises';
import path from 'node:path';
import { fileExists } from '../../util/fsUtil.ts';
import { EtvNextOutputFiles } from './EtvNextPlaylistCreator.ts';
import type { ChannelConfig } from './generated/channelConfig.ts';
import type { PlayoutItem } from './generated/playout.ts';

/**
 * The playout document version the vendored schemas describe. Upstream reads it
 * to decide how to parse the file.
 */
export const PlayoutVersion = 'https://ersatztv.org/playout/version/0.0.3';

/** Upstream's `.ready` deadline. The worker publishes it after four segments. */
export const ReadyTimeoutMs = 30_000;
const ReadyPollIntervalMs = 200;

/**
 * Upstream reaps a worker whose `.heartbeat` is older than this, exiting zero
 * because an idle reap is not a failure. Tunarr's own staleness window should
 * sit below it so Tunarr's connection tracker, not the file clock, decides when
 * a session ends.
 */
export const HeartbeatTimeoutMs = 90_000;

/**
 * The staleness window an `etv_next` session runs with.
 *
 * Tunarr's own default is 120s, which is longer than the worker's reap window,
 * so leaving it alone would let the file clock end sessions before the
 * connection tracker noticed. Two thirds of the reap window leaves room for a
 * missed heartbeat without racing it.
 */
export const DefaultStalenessMs = 60_000;

export class EtvNextNotReadyError extends Error {
  constructor(readonly workspace: string) {
    super(
      `The ErsatzTV next worker did not publish ${EtvNextOutputFiles.ReadyFile} in ${ReadyTimeoutMs}ms (${workspace})`,
    );
    this.name = 'EtvNextNotReadyError';
  }
}

/**
 * One channel's directory on disk, and the two files the worker signals with.
 *
 * ```
 * <base>/etv_<channelUuid>/
 *   channel.json                 read by the worker at spawn
 *   playout/<start>_<finish>.json  the window it plays from
 *   out/                         live.m3u8, live%06d.ts, .ready, .heartbeat
 * ```
 */
export class EtvNextWorkspace {
  readonly root: string;
  readonly channelConfigPath: string;
  readonly playoutDirectory: string;
  readonly outputDirectory: string;
  readonly readyFilePath: string;
  readonly heartbeatFilePath: string;
  readonly mediaPlaylistPath: string;

  constructor(baseDirectory: string, channelUuid: string) {
    this.root = path.join(baseDirectory, `etv_${channelUuid}`);
    this.channelConfigPath = path.join(this.root, 'channel.json');
    this.playoutDirectory = path.join(this.root, 'playout');
    this.outputDirectory = path.join(this.root, 'out');
    this.readyFilePath = path.join(
      this.outputDirectory,
      EtvNextOutputFiles.ReadyFile,
    );
    this.heartbeatFilePath = path.join(
      this.outputDirectory,
      EtvNextOutputFiles.HeartbeatFile,
    );
    this.mediaPlaylistPath = path.join(
      this.outputDirectory,
      EtvNextOutputFiles.MediaPlaylist,
    );
  }

  /** Wipes and recreates the channel's directories. */
  async initialize(): Promise<void> {
    await fs.rm(this.root, { recursive: true, force: true, maxRetries: 2 });
    await fs.mkdir(this.playoutDirectory, { recursive: true });
    await fs.mkdir(this.outputDirectory, { recursive: true });
  }

  async cleanup(): Promise<void> {
    await fs.rm(this.root, { recursive: true, force: true, maxRetries: 2 });
  }

  async writeChannelConfig(config: ChannelConfig): Promise<void> {
    await writeAtomically(
      this.channelConfigPath,
      JSON.stringify(config, undefined, 2),
    );
  }

  /**
   * Writes a playout window, replacing any earlier one.
   *
   * Window selection upstream is first-match over `read_dir`, which is
   * filesystem order rather than sorted, so two overlapping windows would be
   * picked between nondeterministically. Exactly one window file is kept.
   */
  async writePlayoutWindow(
    startMs: number,
    finishMs: number,
    items: PlayoutItem[],
  ): Promise<string> {
    const target = path.join(
      this.playoutDirectory,
      `${startMs}_${finishMs}.json`,
    );

    // Written to a temp name and renamed, so the worker — which re-reads the
    // directory every transcode iteration — never parses a partial document.
    await writeAtomically(
      target,
      JSON.stringify({ version: PlayoutVersion, items }, undefined, 2),
    );

    const existing = await fs.readdir(this.playoutDirectory);
    await Promise.all(
      existing
        .filter((name) => name !== path.basename(target))
        .map((name) =>
          fs.rm(path.join(this.playoutDirectory, name), { force: true }),
        ),
    );

    return target;
  }

  /**
   * Waits for the worker to publish `.ready`.
   *
   * @throws EtvNextNotReadyError once the upstream deadline passes.
   */
  async waitForReady(
    isProcessAlive: () => boolean,
    timeoutMs: number = ReadyTimeoutMs,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (await fileExists(this.readyFilePath)) {
        return;
      }

      if (!isProcessAlive()) {
        throw new EtvNextNotReadyError(this.root);
      }

      await new Promise((resolve) => setTimeout(resolve, ReadyPollIntervalMs));
    }

    throw new EtvNextNotReadyError(this.root);
  }

  /**
   * Touches `.heartbeat` so the worker does not reap itself.
   *
   * Called on each playlist or segment request, alongside the connection
   * tracker's own heartbeat.
   */
  async recordHeartbeat(): Promise<void> {
    const now = new Date();
    try {
      await fs.utimes(this.heartbeatFilePath, now, now);
    } catch {
      // The worker creates the file, so the first touch can land before it
      // exists. Creating it here is equivalent and avoids a startup race.
      const handle = await fs
        .open(this.heartbeatFilePath, 'a')
        .catch(() => null);
      await handle?.close();
    }
  }
}

/** Writes via a sibling temp file and renames, so no reader sees a partial write. */
async function writeAtomically(
  target: string,
  contents: string,
): Promise<void> {
  const scratch = `${target}.${process.pid}.tmp`;
  await fs.writeFile(scratch, contents, 'utf-8');
  await fs.rename(scratch, target);
}
