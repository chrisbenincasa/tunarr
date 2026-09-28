import type { ContentBackedStreamLineupItem } from '@/db/derived_types/StreamLineup.js';
import type { IChannelDB } from '@/db/interfaces/IChannelDB.js';
import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import {
  buildCelContext,
  evaluateProfileRules,
  evaluateStreamSelectionProfile,
  evaluateSubtitleSelection,
} from '@/ffmpeg/StreamSelectionEvaluator.js';
import { ProgramStreamDetailsFetcher } from '@/stream/ProgramStreamDetailsFetcher.js';
import type {
  AudioStreamDetails,
  SubtitleStreamDetails,
} from '@/stream/types.js';
import { isNonEmptyArray } from '@/util/index.js';
import { isNonEmptyString } from '@tunarr/shared/util';
import type {
  StreamSelectionPreviewRequest,
  StreamSelectionPreviewResult,
  StreamSelectionProfile,
} from '@tunarr/types/schemas';
import { inject, injectable } from 'inversify';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import { KEYS } from '../types/inject.ts';
import { CelEvaluationService } from './CelEvaluationService.ts';

export type StreamSelectionPreviewOutcome =
  | { type: 'success'; result: StreamSelectionPreviewResult }
  | { type: 'not_found'; message: string }
  | { type: 'streams_unavailable'; message: string };

type AudioStreamInfo = StreamSelectionPreviewResult['audioStreams'][number];
type SubtitleStreamInfo =
  StreamSelectionPreviewResult['subtitleStreams'][number];

/**
 * Evaluates a single, possibly unsaved, set of rules against a program's real
 * streams. Unlike a live stream, it never cascades to other profiles, so the
 * editor can show exactly what the rules being edited would do.
 */
@injectable()
export class StreamSelectionPreviewService {
  constructor(
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(ProgramStreamDetailsFetcher)
    private streamDetailsFetcher: ProgramStreamDetailsFetcher,
    @inject(CelEvaluationService) private celService: CelEvaluationService,
  ) {}

  async preview(
    request: StreamSelectionPreviewRequest,
  ): Promise<StreamSelectionPreviewOutcome> {
    const program = await this.programDB.getProgramById(request.programId);
    if (!program) {
      return {
        type: 'not_found',
        message: `Program not found: ${request.programId}`,
      };
    }

    let channel: StreamSelectionPreviewResult['channel'];
    if (isNonEmptyString(request.channelId)) {
      const channelOrm = await this.channelDB.getChannel(request.channelId);
      if (!channelOrm) {
        return {
          type: 'not_found',
          message: `Channel not found: ${request.channelId}`,
        };
      }
      channel = {
        uuid: channelOrm.uuid,
        name: channelOrm.name,
        number: channelOrm.number,
      };
    }

    if (!isNonEmptyString(program.mediaSourceId)) {
      return {
        type: 'streams_unavailable',
        message: `Program ${program.uuid} has no media source`,
      };
    }

    const mediaSource = await this.mediaSourceDB.getById(program.mediaSourceId);
    if (!mediaSource) {
      return {
        type: 'streams_unavailable',
        message: `Media source not found: ${program.mediaSourceId}`,
      };
    }

    const streamResult = await this.streamDetailsFetcher.getStream({
      lineupItem: { ...program, mediaSourceId: mediaSource.uuid },
      server: mediaSource,
    });
    if (streamResult.isFailure()) {
      // WrappedError keeps the original message on its cause.
      const { error } = streamResult;
      return {
        type: 'streams_unavailable',
        message: `Failed to load streams: ${error.cause?.message ?? error.message}`,
      };
    }

    const { audioDetails, subtitleDetails } = streamResult.get().streamDetails;
    const audioStreams = audioDetails ?? [];
    const subtitleStreams = subtitleDetails ?? [];

    const profile: StreamSelectionProfile = {
      uuid: 'preview',
      name: 'Preview',
      locked: false,
      rules: request.rules,
    };
    const celContext = buildCelContext(
      audioStreams,
      subtitleStreams,
      channel ?? { name: '', number: 0 },
      { title: program.title, type: program.type },
    );

    const { rules, matchedRuleIndex } = evaluateProfileRules(
      profile,
      this.celService,
      celContext,
    );

    let selectedAudioStream: AudioStreamDetails | undefined;
    let selectedSubtitleStream: SubtitleStreamDetails | null = null;

    if (matchedRuleIndex !== null) {
      const lineupItem: ContentBackedStreamLineupItem = {
        type: 'program',
        program: { ...program, mediaSourceId: mediaSource.uuid },
        duration: program.duration,
        infiniteLoop: false,
        programBeginMs: Date.now(),
        streamDuration: program.duration,
      };

      // Same hint as Troubleshoot, so the two tools report the same streams.
      const hints = { preferTextBased: true };

      if (isNonEmptyArray(audioStreams)) {
        const selection = await evaluateStreamSelectionProfile(
          profile,
          audioStreams,
          subtitleStreams,
          this.celService,
          celContext,
          lineupItem,
          hints,
        );
        selectedAudioStream = selection.audioStream;
        selectedSubtitleStream = selection.subtitleStream;
      } else {
        selectedSubtitleStream = await evaluateSubtitleSelection(
          profile,
          subtitleStreams,
          this.celService,
          celContext,
          lineupItem,
          hints,
        );
      }
    }

    return {
      type: 'success',
      result: {
        program: {
          uuid: program.uuid,
          title: program.title,
          type: program.type,
        },
        channel,
        audioStreams: audioStreams.map(toAudioStreamInfo),
        subtitleStreams: subtitleStreams.map(toSubtitleStreamInfo),
        rules: rules.map((rule) => ({
          ...rule,
          error: this.celService.validate(rule.condition)?.message,
        })),
        matchedRuleIndex,
        selectedAudioStream: selectedAudioStream
          ? toAudioStreamInfo(selectedAudioStream)
          : undefined,
        selectedSubtitleStream: selectedSubtitleStream
          ? toSubtitleStreamInfo(selectedSubtitleStream)
          : null,
      },
    };
  }
}

function toAudioStreamInfo(stream: AudioStreamDetails): AudioStreamInfo {
  return {
    index: stream.index,
    codec: stream.codec ?? 'unknown',
    language:
      stream.languageCodeISO6392 ??
      stream.languageCodeISO6391 ??
      stream.language,
    channels: stream.channels,
    title: stream.title,
    default: stream.default,
    selected: stream.selected,
    forced: stream.forced,
    bitrate: stream.bitrate,
  };
}

function toSubtitleStreamInfo(
  stream: SubtitleStreamDetails,
): SubtitleStreamInfo {
  return {
    index: stream.index ?? 0,
    codec: stream.codec ?? 'unknown',
    language:
      stream.languageCodeISO6392 ??
      stream.languageCodeISO6391 ??
      stream.language,
    title: stream.title,
    type: stream.type,
    default: stream.default,
    forced: stream.forced,
    sdh: stream.sdh,
  };
}
