import type { ChildProcessHelper } from '@/util/ChildProcessHelper.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { StreamLineupItem } from '../../db/derived_types/StreamLineup.ts';
import type { ChannelOrmWithTranscodeConfig } from '../../db/schema/derivedTypes.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import type { EtvNextBinaryResolver } from './EtvNextBinaryResolver.ts';
import type { MappedFfmpegSettings } from './EtvNextChannelConfigMapper.ts';
import {
  toChannelConfig,
  UnsupportedTranscodeConfigError,
} from './EtvNextChannelConfigMapper.ts';
import { StreamTerminationRequestedError } from './EtvNextPlayoutItemMapper.ts';
import { EtvNextOutputFiles } from './EtvNextPlaylistCreator.ts';
import type { ChannelConfig } from './generated/channelConfig.ts';
import type {
  EtvNextPlayoutWriter,
  MaterializedWindow,
} from './EtvNextPlayoutWriter.ts';
import { EtvNextWorkspace } from './EtvNextWorkspace.ts';

/**
 * The playlist a `--troubleshoot` run leaves behind.
 *
 * The worker maintains `live.m3u8` as it plays, but a troubleshoot run works
 * ahead and terminates, so that file stays an empty header. FFmpeg's own
 * playlist is the complete one, with every segment and an `EXT-X-ENDLIST`.
 */
const VodPlaylistName = 'ffmpeg.m3u8';

/** The worker prints its resolved FFmpeg command before running it. */
const PipelineLinePattern = /optimized pipeline:\s*(.+)$/m;

/** Enough of the worker log to carry a failure, short enough to render. */
const StderrTailLines = 60;

/** The worker names each troubleshoot dossier `<number>_<timestamp>_probe`. */
const ProbeDossierSuffix = '_probe';

export type EtvNextTroubleshootRun = {
  /** Where the worker's output landed, for the troubleshoot stream route. */
  outputDirectory: string;
  exitCode: number | null;
  signal: string | null;
  success: boolean;
  stderr: string;

  /** The worker's resolved FFmpeg command, absent when it never got that far. */
  ffmpegCommand?: string;

  /** The worker's FFmpeg report, written whether or not file logging is on. */
  report?: string;

  /** Settings the backend dropped, and the ones that stopped the run. */
  notes: string[];
};

/**
 * Runs one diagnostic transcode through the ErsatzTV next worker.
 *
 * `ersatztv-channel run --troubleshoot` is built for this. It works ahead
 * rather than in realtime, transcodes the window, and exits on its own — zero
 * on success, non-zero on failure — so this needs no kill timer beyond a
 * safety net and waits for no `.ready` file, which that path never writes.
 *
 * The run is self-contained. It gets a workspace under the troubleshoot
 * session's own directory and never touches a live channel's, so it cannot
 * collide with a running worker.
 *
 * Built by a factory in `StreamModule` rather than by decorators. Reading
 * `EtvNextPlayoutWriter` as a decorator argument pulls its import chain back
 * into `container.ts` while that module is still initializing.
 */
export class EtvNextTroubleshootRunner {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    private binaryResolver: EtvNextBinaryResolver,
    private playoutWriter: EtvNextPlayoutWriter,
    private childProcessHelper: ChildProcessHelper,
  ) {}

  /**
   * @param baseDirectory the troubleshoot session's directory, which the caller
   *   owns and deletes.
   */
  async run({
    channel,
    lineupItem,
    ffmpegSettings,
    baseDirectory,
    sessionId,
    timeoutMs,
  }: {
    channel: ChannelOrmWithTranscodeConfig;
    lineupItem: StreamLineupItem;
    ffmpegSettings: MappedFfmpegSettings;
    baseDirectory: string;
    sessionId: string;
    timeoutMs: number;
  }): Promise<EtvNextTroubleshootRun> {
    const workspace = new EtvNextWorkspace(baseDirectory, sessionId);
    await workspace.initialize();

    const stopped = (
      reason: string,
      notes: string[] = [],
    ): EtvNextTroubleshootRun => ({
      outputDirectory: workspace.outputDirectory,
      exitCode: null,
      signal: null,
      success: false,
      stderr: reason,
      notes,
    });

    let config: ChannelConfig;
    const notes: string[] = [];
    try {
      // The dossier is worth having whether or not the user turned on file
      // logging, since this run exists to be diagnosed.
      const mapping = toChannelConfig({
        transcodeConfig: channel.transcodeConfig,
        ffmpegSettings,
        playoutFolder: workspace.playoutDirectory,
        reportsFolder: workspace.root,
      });
      config = mapping.config;
      notes.push(
        ...mapping.ignored.map(
          ({ field, reason }) => `${field} is ignored: ${reason}`,
        ),
      );
    } catch (e) {
      if (e instanceof UnsupportedTranscodeConfigError) {
        return stopped(e.message, e.settings.map(describeUnsupported));
      }
      throw e;
    }

    await workspace.writeChannelConfig(config);

    let window: MaterializedWindow;
    try {
      window = await this.playoutWriter.materializeProgram({
        channel,
        lineupItem,
        startMs: Date.now(),
      });
    } catch (e) {
      if (e instanceof StreamTerminationRequestedError) {
        return stopped(
          `The error screen is set to end the stream, so this item produced nothing to transcode (${e.reason}).`,
          notes,
        );
      }
      throw e;
    }

    notes.push(...window.ignored);
    await workspace.writePlayoutWindow(
      window.startMs,
      window.finishMs,
      window.items,
    );

    const executablePath = await this.binaryResolver.resolveChecked();
    const exit = await this.spawnAndWait({
      executablePath,
      workspace,
      channelNumber: channel.number,
      timeoutMs,
    });

    await this.publishVodPlaylist(workspace.outputDirectory);

    return {
      outputDirectory: workspace.outputDirectory,
      exitCode: exit.code,
      signal: exit.signal,
      success: exit.code === 0,
      stderr: redactSecrets(exit.stderr) ?? '',
      ffmpegCommand: redactSecrets(
        PipelineLinePattern.exec(exit.stderr)?.[1]?.trim(),
      ),
      report: redactSecrets(await this.readReport(workspace.root)),
      notes,
    };
  }

  private async spawnAndWait({
    executablePath,
    workspace,
    channelNumber,
    timeoutMs,
  }: {
    executablePath: string;
    workspace: EtvNextWorkspace;
    channelNumber: number;
    timeoutMs: number;
  }): Promise<{ code: number | null; signal: string | null; stderr: string }> {
    const wrapper = await this.childProcessHelper.spawn(
      executablePath,
      [
        'run',
        workspace.channelConfigPath,
        '--output-folder',
        workspace.outputDirectory,
        '--number',
        `${channelNumber}`,
        '--troubleshoot',
      ],
      {
        name: `etv-next-troubleshoot-${channelNumber}`,
        restartOnFailure: false,
        maxAttempts: 1,
      },
    );

    const child = wrapper.process;
    if (child === undefined) {
      return { code: null, signal: null, stderr: 'The worker did not start.' };
    }

    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    return await new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.logger.error(
          'A troubleshoot transcode ran past %dms. Stopping the worker.',
          timeoutMs,
        );
        wrapper.kill();
        resolve({ code: null, signal: 'TIMEOUT', stderr: tail(stderr) });
      }, timeoutMs);

      child.on('exit', (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal, stderr: tail(stderr) });
      });
    });
  }

  /**
   * Puts the complete playlist where the troubleshoot player looks for it.
   *
   * The stream route and the page both address `live.m3u8`, and on this path
   * the worker leaves that file an empty header, so serving it as written
   * would hand the player nothing to play.
   */
  private async publishVodPlaylist(outputDirectory: string): Promise<void> {
    try {
      await fs.copyFile(
        path.join(outputDirectory, VodPlaylistName),
        path.join(outputDirectory, EtvNextOutputFiles.MediaPlaylist),
      );
    } catch (e) {
      this.logger.debug(
        e,
        'The worker wrote no %s, so the troubleshoot run has no playable output.',
        VodPlaylistName,
      );
    }
  }

  /**
   * Reads the FFmpeg report out of the dossier a troubleshoot run leaves.
   *
   * The worker collects each run into its own `<number>_<timestamp>_probe`
   * directory under the reports folder, alongside the pipeline, media info and
   * playout item it resolved. Only the FFmpeg report goes into the result,
   * because the rest is already there as `pipeline` and `mediaInfo`.
   */
  private async readReport(reportsFolder: string): Promise<string | undefined> {
    try {
      const entries = await fs.readdir(reportsFolder, { withFileTypes: true });
      const dossier = entries.find(
        (e) => e.isDirectory() && e.name.endsWith(ProbeDossierSuffix),
      );
      if (dossier === undefined) {
        return undefined;
      }

      return await fs.readFile(
        path.join(reportsFolder, dossier.name, 'ffreport.log'),
        'utf-8',
      );
    } catch {
      return undefined;
    }
  }
}

/** Keeps the end of the worker's log, which is where a failure explains itself. */
function tail(stderr: string, lines = StderrTailLines): string {
  return stderr.split('\n').slice(-lines).join('\n').trim();
}

/**
 * Strips media-server credentials from anything the report shows the user.
 *
 * Every string here can quote an HTTP source URL, and troubleshoot output is
 * written to be pasted into a bug report.
 */
function redactSecrets(text: string | undefined): string | undefined {
  return text
    ?.replace(/(X-Plex-Token=)[A-Za-z0-9_-]+/g, '$1REDACTED')
    .replace(/(X-Emby-Token[:=]\s*)[A-Za-z0-9_-]+/g, '$1REDACTED')
    .replace(/(api_key=)[A-Za-z0-9_-]+/g, '$1REDACTED');
}

function describeUnsupported({
  field,
  value,
  reason,
}: {
  field: string;
  value: string;
  reason: string;
}): string {
  return `${field} (${value}) is unsupported: ${reason}`;
}
