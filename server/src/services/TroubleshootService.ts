import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';

import type {
  ContentBackedStreamLineupItem,
  StreamLineupItem,
} from '@/db/derived_types/StreamLineup.js';
import {
  buildCelContext,
  evaluateStreamSelectionChain,
} from '@/ffmpeg/StreamSelectionEvaluator.js';
import {
  defaultHlsOptions,
  HlsOutputFormat,
} from '@/ffmpeg/builder/constants.js';
import { FfmpegInfo } from '@/ffmpeg/ffmpegInfo.js';
import { ProgramStreamDetailsFetcher } from '@/stream/ProgramStreamDetailsFetcher.js';
import type { ProgramStreamResult } from '@/stream/types.js';
import { isNonEmptyArray } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { getTunarrVersion } from '@/util/version.js';
import { isNonEmptyString } from '@tunarr/shared/util';
import type { TroubleshootStreamSelectionTrace } from '@tunarr/types';
import type {
  TroubleshootRequest,
  TroubleshootResult,
} from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import { inject, injectable } from 'inversify';
import { isNil, omitBy, random } from 'lodash-es';
import { basename, dirname } from 'memfs/lib/vendor/node/path.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { v4 as uuidv4 } from 'uuid';
import type { ChannelDB } from '../db/ChannelDB.ts';
import { TranscodeConfigDB } from '../db/TranscodeConfigDB.ts';
import { ormChannelToApiChannel } from '../db/converters/channelConverters.ts';
import { transcodeConfigOrmToDto } from '../db/converters/transcodeConfigConverters.ts';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import { PlayerContext } from '../stream/PlayerStreamContext.ts';
import type { ProgramStreamFactory } from '../stream/ProgramStreamFactory.ts';
import { KEYS } from '../types/inject.js';
import { TroubleshootSessionFolderName } from '../util/constants.ts';
import { CelEvaluationService } from './CelEvaluationService.js';
import { StreamSelectionProfileResolver } from './StreamSelectionProfileResolver.js';

dayjs.extend(duration);

@injectable()
export class TroubleshootService {
  private readonly logger = LoggerFactory.child({
    className: TroubleshootService.name,
  });

  private readonly activeSessions = new Map<string, string>();

  constructor(
    @inject(FfmpegInfo) private ffmpegInfo: FfmpegInfo,
    @inject(ProgramStreamDetailsFetcher)
    private streamDetailsFetcher: ProgramStreamDetailsFetcher,
    @inject(StreamSelectionProfileResolver)
    private profileResolver: StreamSelectionProfileResolver,
    @inject(CelEvaluationService)
    private celService: CelEvaluationService,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(KEYS.ChannelDB) private channelDB: ChannelDB,
    @inject(TranscodeConfigDB) private transcodeConfigDB: TranscodeConfigDB,
    @inject(KEYS.ProgramStreamFactory)
    private programStreamFactory: ProgramStreamFactory,
  ) {}

  getSessionDirectory(sessionId: string): string | undefined {
    return this.activeSessions.get(sessionId);
  }

  async runTroubleshoot(
    request: TroubleshootRequest,
  ): Promise<TroubleshootResult> {
    this.logger.info('Starting troubleshoot for program %s', request.programId);
    const errors: string[] = [];
    const result: TroubleshootResult = {
      systemInfo: {
        tunarrVersion: getTunarrVersion(),
        ffmpegVersion: 'unknown',
        nodeVersion: process.version,
        platform: `${process.platform} (${os.release()})`,
        arch: process.arch,
        availableHwAccels: [],
      },
      errors,
      timestamp: new Date().toISOString(),
    };

    // Stage 1: System Info
    try {
      const [version, hwAccels] = await Promise.all([
        this.ffmpegInfo.getVersion(),
        this.ffmpegInfo.getHwAccels(),
      ]);
      result.systemInfo = {
        ...result.systemInfo,
        ffmpegVersion: version.versionString,
        availableHwAccels: hwAccels,
      };
    } catch (err) {
      errors.push(`System info: ${String(err)}`);
    }

    // Stage 2: Load Program & Media Info
    const program = await this.programDB.getProgramById(request.programId);
    if (!program) {
      errors.push(`Program not found: ${request.programId}`);
      return result;
    }

    let streamDetails: ProgramStreamResult;

    try {
      if (!isNonEmptyString(program.mediaSourceId)) {
        errors.push(
          `Program ID ${program.uuid} does not have a media source ID`,
        );
        return result;
      }

      const mediaSource = await this.mediaSourceDB.getById(
        program.mediaSourceId,
      );

      if (!mediaSource) {
        errors.push(
          `Media source not found for program: ${program.mediaSourceId}`,
        );
        return result;
      }

      const streamResult = await this.streamDetailsFetcher.getStream({
        lineupItem: {
          ...program,
          mediaSourceId: mediaSource.uuid,
        },
        server: mediaSource,
      });

      if (streamResult.isFailure()) {
        errors.push(
          `Failed to get stream details: ${String(streamResult.error)}`,
        );
        return result;
      }

      streamDetails = streamResult.get();

      const redactPath = (p: string) =>
        p
          .replace(/(X-Plex-Token=)[A-Za-z0-9_-]+/g, '$1REDACTED')
          .replace(/(X-Emby-Token:\s)[A-Za-z0-9_-]+/g, '$1REDACTED')
          .replace(/(api_key=)[A-Za-z0-9_-]+/g, '$1REDACTED');

      result.mediaInfo = {
        title: program.title,
        type: program.type,
        duration: program.duration,
        sourceType: mediaSource.type,
        streamSourceType: streamDetails.streamSource.type,
        streamSourcePath: redactPath(streamDetails.streamSource.path),
        videoStreams:
          streamDetails.streamDetails.videoDetails?.map((v) => ({
            index: v.streamIndex ?? 0,
            codec: v.codec ?? 'unknown',
            profile: v.profile,
            width: v.width,
            height: v.height,
            framerate: v.framerate?.toString(),
            pixelFormat: v.pixelFormat,
            bitDepth: v.bitDepth,
            colorRange: v.colorRange,
            colorSpace: v.colorSpace,
            colorTransfer: v.colorTransfer,
            colorPrimaries: v.colorPrimaries,
            sampleAspectRatio: v.sampleAspectRatio,
            displayAspectRatio: v.displayAspectRatio,
            bitrate: v.bitrate,
          })) ?? [],
        audioStreams:
          streamDetails.streamDetails.audioDetails?.map((a) => ({
            index: a.index,
            codec: a.codec ?? 'unknown',
            language:
              a.languageCodeISO6392 ?? a.languageCodeISO6391 ?? a.language,
            channels: a.channels,
            title: a.title,
            default: a.default,
            selected: a.selected,
            forced: a.forced,
            bitrate: a.bitrate,
          })) ?? [],
        subtitleStreams:
          streamDetails.streamDetails.subtitleDetails?.map((s) => ({
            index: s.index ?? 0,
            codec: s.codec ?? 'unknown',
            language:
              s.languageCodeISO6392 ?? s.languageCodeISO6391 ?? s.language,
            title: s.title,
            type: s.type,
            default: s.default,
            forced: s.forced,
            sdh: s.sdh,
          })) ?? [],
      };
    } catch (err) {
      errors.push(`Media info: ${String(err)}`);
      return result;
    }

    // Stage 3: Load Channel & Transcode Config
    const channel = await this.channelDB.getChannelOrm(request.channelId);
    const lineup = await this.channelDB.loadLineup(request.channelId);

    if (!channel) {
      errors.push(`Channel not found: ${request.channelId}`);
      return result;
    }

    let transcodeConfig = channel.transcodeConfig;
    if (isNonEmptyString(request.transcodeConfigId)) {
      const override = await this.transcodeConfigDB.getById(
        request.transcodeConfigId,
      );
      if (override) {
        transcodeConfig = override;
      } else {
        errors.push(
          `Transcode config override not found: ${request.transcodeConfigId}, using channel default`,
        );
      }
    }

    result.transcodeConfig = transcodeConfigOrmToDto(transcodeConfig);
    result.channelConfig = ormChannelToApiChannel({ channel, lineup });

    // Stage 4: Stream Selection Trace (diagnostic only — the real stream
    // session will perform its own selection through the same code path)
    try {
      // The request only names a program, so look for it in the channel's
      // lineup to learn whether it plays from a filler list or custom show.
      const lineupEntry = lineup?.items.find(
        (item) => item.type === 'content' && item.id === program.uuid,
      );
      const fillerListId =
        lineupEntry?.type === 'content' &&
        isNonEmptyString(lineupEntry.fillerListId)
          ? lineupEntry.fillerListId
          : undefined;
      const customShowId =
        lineupEntry?.type === 'content' ? lineupEntry.customShowId : undefined;

      const chain = await this.profileResolver.resolveChain({
        channelId: channel.uuid,
        programId: program.uuid,
        fillerListId,
        customShowId,
      });

      const audioStreams = streamDetails.streamDetails.audioDetails;
      const subtitleStreams = streamDetails.streamDetails.subtitleDetails;

      const trace: TroubleshootStreamSelectionTrace = { levels: [] };

      if (isNonEmptyArray(audioStreams)) {
        const baseItem = {
          program: { ...program, mediaSourceId: program.mediaSourceId },
          duration: program.duration,
          infiniteLoop: false,
          programBeginMs: +dayjs(),
          streamDuration: program.duration,
        };
        const selectionLineupItem: ContentBackedStreamLineupItem = fillerListId
          ? { ...baseItem, type: 'commercial', fillerListId }
          : { ...baseItem, type: 'program', customShowId };

        const celContext = buildCelContext(
          audioStreams,
          subtitleStreams,
          { name: channel.name, number: channel.number },
          { title: program.title, type: program.type },
        );

        const evaluation = await evaluateStreamSelectionChain(
          chain,
          audioStreams,
          subtitleStreams,
          this.celService,
          celContext,
          selectionLineupItem,
          { preferTextBased: true },
        );

        trace.levels = evaluation.levels.map((levelTrace, levelIdx) => {
          const profile = chain[levelIdx]?.profile;
          return {
            level: levelTrace.level,
            sourceId: levelTrace.sourceId,
            profileId: levelTrace.profileId,
            profileName: levelTrace.profileName,
            matched: levelTrace.matchedRuleIndex !== null,
            rules: levelTrace.rules.map((ruleTrace, ruleIdx) => {
              const rule = profile?.rules[ruleIdx];
              return {
                ...ruleTrace,
                applied:
                  levelIdx === evaluation.levels.length - 1 &&
                  levelTrace.matchedRuleIndex === ruleIdx,
                audioAction: rule
                  ? this.describeAudioAction(rule.audioAction)
                  : undefined,
                subtitleAction: rule
                  ? this.describeSubtitleAction(rule.subtitleAction)
                  : undefined,
              };
            }),
          };
        });

        const selectedAudio = evaluation.audioStream;
        trace.selectedAudioStream = {
          index: selectedAudio.index,
          codec: selectedAudio.codec ?? 'unknown',
          language:
            selectedAudio.languageCodeISO6392 ??
            selectedAudio.languageCodeISO6391 ??
            selectedAudio.language,
          channels: selectedAudio.channels,
          title: selectedAudio.title,
          default: selectedAudio.default,
        };

        const selectedSubtitle = evaluation.subtitleStream;
        if (selectedSubtitle) {
          trace.selectedSubtitleStream = {
            index: selectedSubtitle.index ?? 0,
            codec: selectedSubtitle.codec ?? 'unknown',
            language:
              selectedSubtitle.languageCodeISO6392 ??
              selectedSubtitle.languageCodeISO6391 ??
              selectedSubtitle.language,
            type: selectedSubtitle.type,
            default: selectedSubtitle.default,
            forced: selectedSubtitle.forced,
            sdh: selectedSubtitle.sdh,
          };
        } else {
          trace.selectedSubtitleStream = null;
          const ruleName = evaluation.matchedRule?.label ?? 'unlabeled rule';
          trace.subtitleReason = !evaluation.matchedRule
            ? 'No rule matched'
            : evaluation.matchedRule.subtitleAction.type === 'disable'
              ? `Disabled by rule "${ruleName}"`
              : `No subtitle stream satisfied rule "${ruleName}"`;
        }
      } else {
        trace.subtitleReason = 'No audio streams available';
      }

      result.streamSelection = trace;
    } catch (err) {
      errors.push(`Stream selection: ${String(err)}`);
    }

    // Stage 5 & 6: Create stream session using the real pipeline and run
    // the test transcode. This uses the exact same code path as production
    // streaming (FfmpegStreamFactory.createStreamSession).
    const sessionId = uuidv4();
    const tempDir = path.join(
      os.tmpdir(),
      TroubleshootSessionFolderName,
      sessionId,
    );
    await fs.mkdir(tempDir, { recursive: true });
    this.activeSessions.set(sessionId, tempDir);

    try {
      const testDurationMs = request.testDurationSeconds * 1000;
      const programDurationMs = program.duration;
      const maxStartMs = Math.max(0, programDurationMs - testDurationMs - 5000);
      const startTimeMs = maxStartMs > 0 ? random(0, maxStartMs) : 0;

      const watermark =
        channel.watermark?.enabled === true ? channel.watermark : undefined;

      const lineupItem: StreamLineupItem = {
        type: 'program',
        program: { ...program, mediaSourceId: program.mediaSourceId },
        duration: program.duration,
        infiniteLoop: false,
        programBeginMs: +dayjs(),
        streamDuration: testDurationMs,
      };

      const hlsOutputFormat = HlsOutputFormat({
        ...defaultHlsOptions,
        hlsTime: 4,
        hlsListSize: 0,
        segmentBaseDirectory: dirname(tempDir),
        streamBasePath: basename(tempDir),
        streamBaseUrl: `/api/troubleshoot/stream/${sessionId}/`,
        segmentNameFormat: 'live%06d.ts',
        streamNameFormat: 'live.m3u8',
        subtitleStreamNameFormat: 'subs.m3u8',
        deleteThreshold: null,
        appendSegments: true,
      });

      const programStream = this.programStreamFactory(
        new PlayerContext(lineupItem, channel, channel, transcodeConfig, {
          audioOnly: false,
          realtime: false,
          streamMode: channel.streamMode,
        }),
        hlsOutputFormat,
        {
          startTime: dayjs.duration(startTimeMs),
          duration: dayjs.duration(testDurationMs),
          watermark,
          realtime: false,
          outputFormat: hlsOutputFormat,
          streamMode: channel.streamMode,
          isFirstTranscode: true,
          emitEndList: true,
        },
      );

      const sessionResult = await programStream.setup();

      if (sessionResult.isFailure()) {
        errors.push(
          `Failed to create FFmpeg stream session: ${sessionResult.error.message}`,
        );
        return result;
      }

      const session = sessionResult.get();

      // const { session } = sessionResult;

      // Extract pipeline info from the real session's process.
      const redactArg = (arg: string) =>
        arg
          .replace(/(X-Plex-Token=)[A-Za-z0-9_-]+/g, '$1REDACTED')
          .replace(/(X-Emby-Token:\s)[A-Za-z0-9_-]+/g, '$1REDACTED')
          .replace(/(api_key=)[A-Za-z0-9_-]+/g, '$1REDACTED');

      const redactedArgs = session.process.args.map(redactArg);

      result.pipeline = {
        hardwareAccelMode: transcodeConfig.hardwareAccelerationMode ?? 'none',
        builderType: 'FfmpegStreamFactory',
        pipelineSteps: [],
        ffmpegArgs: redactedArgs,
        ffmpegArgsString: redactedArgs.join(' '),
        environmentVariables: omitBy(
          session.process.environmentVariables,
          isNil,
        ) as Record<string, string>,
      };

      // Stage 6: Run the test transcode using the real session.
      try {
        const exitResult = await new Promise<{
          code: number | null;
          signal: string | null;
        }>((resolve) => {
          const stdout = session.start();

          if (!stdout) {
            resolve({ code: -1, signal: null });
            return;
          }

          // Discard stdout — HLS output goes to files in tempDir.
          stdout.pipe(
            new Writable({
              write(_chunk, _encoding, callback) {
                callback();
              },
            }),
          );

          session.process.on('exit', (code, signal) => {
            resolve({ code, signal: signal ?? null });
          });

          session.process.on('error', (err) => {
            resolve({
              code: (err as { code?: number }).code ?? -1,
              signal: null,
            });
          });

          // Safety timeout
          const timeout = setTimeout(
            () => {
              session.kill();
              resolve({ code: -1, signal: 'TIMEOUT' });
            },
            request.testDurationSeconds * 2 * 1000 + 30000,
          );

          session.process.on('end', () => {
            clearTimeout(timeout);
          });
        });

        // Read the FFmpeg report file if it was written
        let ffmpegLogContent = '';
        try {
          const reportFiles = await fs.readdir(tempDir);
          const reportFile = reportFiles.find(
            (f) => f.startsWith('ffmpeg-') && f.endsWith('.log'),
          );
          if (reportFile) {
            ffmpegLogContent = await fs.readFile(
              path.join(tempDir, reportFile),
              'utf-8',
            );
          }
        } catch {
          // No report file available
        }

        result.testTranscode = {
          exitCode: exitResult.code,
          signal: exitResult.signal,
          success: exitResult.code === 0,
          stderrOutput: '',
          hlsSessionId: sessionId,
        };

        if (ffmpegLogContent) {
          result.ffmpegLog = ffmpegLogContent;
        }
      } catch (err) {
        errors.push(`Test transcode: ${String(err)}`);
      }
    } catch (err) {
      errors.push(`Pipeline/transcode: ${String(err)}`);
    }

    // Schedule cleanup of the temp directory after 5 minutes
    setTimeout(
      () => {
        this.activeSessions.delete(sessionId);
        fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      },
      5 * 60 * 1000,
    );

    return result;
  }

  private describeAudioAction(action: {
    type: string;
    languages?: string[];
    titleContains?: string;
    preferChannels?: string;
  }): string {
    switch (action.type) {
      case 'by_language':
        return `Select audio by language: [${action.languages?.join(', ')}]${action.preferChannels ? ` (prefer ${action.preferChannels} channels)` : ''}`;
      case 'by_title':
        return `Select audio by title containing: "${action.titleContains}"`;
      case 'default':
        return 'Use default audio stream';
      default:
        return `Unknown action: ${action.type}`;
    }
  }

  private describeSubtitleAction(action: {
    type: string;
    languages?: string[];
    filterType?: string;
    allowImageBased?: boolean;
    allowExternal?: boolean;
  }): string {
    switch (action.type) {
      case 'disable':
        return 'Disable subtitles';
      case 'by_language': {
        const parts = [
          `Select subtitles by language: [${action.languages?.join(', ')}]`,
        ];
        if (action.filterType && action.filterType !== 'any') {
          parts.push(`filter: ${action.filterType}`);
        }
        if (action.allowImageBased === false) {
          parts.push('no image-based');
        }
        if (action.allowExternal === false) {
          parts.push('no external');
        }
        return parts.join(', ');
      }
      case 'default':
        return 'Use default subtitle stream';
      default:
        return `Unknown action: ${action.type}`;
    }
  }
}
