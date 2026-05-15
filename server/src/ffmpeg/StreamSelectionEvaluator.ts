import type {
  AudioAction,
  StreamSelectionProfile,
  SubtitleAction,
} from '@tunarr/types/schemas';
import type { NonEmptyArray } from 'ts-essentials';
import type { ContentBackedStreamLineupItem } from '../db/derived_types/StreamLineup.ts';
import type {
  CelEvaluationService,
  StreamSelectionCelContext,
} from '../services/CelEvaluationService.ts';
import type {
  AudioStreamDetails,
  SubtitleStreamDetails,
} from '../stream/types.ts';
import { isDefined } from '../util/index.ts';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';
import { SubtitleStreamPicker } from './SubtitleStreamPicker.ts';

const logger = LoggerFactory.child({ className: 'StreamSelectionEvaluator' });

export type StreamSelectionResult = {
  audioStream: AudioStreamDetails;
  subtitleStream: SubtitleStreamDetails | null;
};

export function buildCelContext(
  audioStreams: NonEmptyArray<AudioStreamDetails>,
  subtitleStreams: SubtitleStreamDetails[] | undefined,
  channel: { name: string; number: number },
  program: { title: string; type: string },
): StreamSelectionCelContext {
  const audioLanguages = [
    ...new Set(
      audioStreams
        .map(
          (s) => s.languageCodeISO6392 ?? s.languageCodeISO6391 ?? s.language,
        )
        .filter(isDefined),
    ),
  ];

  const subtitleLanguages = [
    ...new Set(
      (subtitleStreams ?? [])
        .map(
          (s) => s.languageCodeISO6392 ?? s.languageCodeISO6391 ?? s.language,
        )
        .filter(isDefined),
    ),
  ];

  return {
    audio: {
      streams: audioStreams.map((s) => ({
        index: s.index,
        language:
          s.languageCodeISO6392 ?? s.languageCodeISO6391 ?? s.language ?? '',
        codec: s.codec ?? '',
        channels: s.channels ?? 0,
        title: s.title ?? '',
        default: s.default ?? false,
        selected: s.selected ?? false,
      })),
      languages: audioLanguages,
    },
    subtitle: {
      streams: (subtitleStreams ?? []).map((s) => ({
        index: s.index ?? 0,
        language:
          s.languageCodeISO6392 ?? s.languageCodeISO6391 ?? s.language ?? '',
        codec: s.codec ?? '',
        type: s.type,
        title: s.title ?? '',
        default: s.default ?? false,
        forced: s.forced ?? false,
        sdh: s.sdh ?? false,
      })),
      languages: subtitleLanguages,
    },
    channel,
    program,
  };
}

export type StreamSelectionHints = {
  preferTextBased?: boolean;
};

export async function evaluateStreamSelectionProfile(
  profile: StreamSelectionProfile,
  audioStreams: NonEmptyArray<AudioStreamDetails>,
  subtitleStreams: SubtitleStreamDetails[] | undefined,
  celService: CelEvaluationService,
  celContext: StreamSelectionCelContext,
  lineupItem: ContentBackedStreamLineupItem,
  hints?: StreamSelectionHints,
): Promise<StreamSelectionResult> {
  for (const rule of profile.rules) {
    const conditionResult = celService.evaluate(rule.condition, celContext);
    if (conditionResult) {
      logger.debug(
        'Stream selection rule matched: %s (condition: %s)',
        rule.label ?? '(unlabeled)',
        rule.condition,
      );
      const audioStream = resolveAudioAction(rule.audioAction, audioStreams);
      const subtitleStream = await resolveSubtitleAction(
        rule.subtitleAction,
        subtitleStreams,
        lineupItem,
        hints,
      );
      return { audioStream, subtitleStream };
    }
  }

  // No rule matched - fallback to first audio stream, no subtitles
  logger.debug('No stream selection rule matched, using defaults');
  return {
    audioStream: audioStreams[0],
    subtitleStream: null,
  };
}

export function resolveAudioAction(
  action: AudioAction,
  audioStreams: NonEmptyArray<AudioStreamDetails>,
): AudioStreamDetails {
  switch (action.type) {
    case 'by_language': {
      for (const lang of action.languages) {
        const langLower = lang.toLowerCase();
        let matches = audioStreams.filter((stream) => {
          return (
            stream.languageCodeISO6392?.toLowerCase() === langLower ||
            stream.languageCodeISO6391?.toLowerCase() === langLower ||
            stream.language?.toLowerCase() === langLower
          );
        });

        if (matches.length > 0) {
          if (action.preferChannels === 'most') {
            matches = matches.sort(
              (a, b) => (b.channels ?? 0) - (a.channels ?? 0),
            );
          } else if (action.preferChannels === 'least') {
            matches = matches.sort(
              (a, b) => (a.channels ?? 0) - (b.channels ?? 0),
            );
          }
          return matches[0]!;
        }
      }
      // Fallback to default behavior
      return selectDefaultAudioStream(audioStreams);
    }

    case 'by_title': {
      const titleLower = action.titleContains.toLowerCase();
      const match = audioStreams.find((s) =>
        s.title?.toLowerCase().includes(titleLower),
      );
      return match ?? selectDefaultAudioStream(audioStreams);
    }

    case 'default':
      return selectDefaultAudioStream(audioStreams);
  }
}

function selectDefaultAudioStream(
  audioStreams: NonEmptyArray<AudioStreamDetails>,
) {
  return (
    audioStreams.find((s) => s.selected) ??
    audioStreams.find((s) => s.default) ??
    audioStreams[0]
  );
}

async function resolveSubtitleAction(
  action: SubtitleAction,
  subtitleStreams: SubtitleStreamDetails[] | undefined,
  lineupItem: ContentBackedStreamLineupItem,
  hints?: StreamSelectionHints,
): Promise<SubtitleStreamDetails | null> {
  switch (action.type) {
    case 'disable':
      return null;

    case 'default': {
      if (!subtitleStreams || subtitleStreams.length === 0) {
        return null;
      }

      const effectivePreferText =
        hints?.preferTextBased || action.preferTextBased;

      const candidates = [...subtitleStreams];
      if (effectivePreferText) {
        candidates.sort((a, b) => {
          const aImage = isImageBasedSubtitle(a.codec) ? 1 : 0;
          const bImage = isImageBasedSubtitle(b.codec) ? 1 : 0;
          return aImage - bImage;
        });
      }

      const defaultStream = candidates.find((s) => s.default);
      if (!defaultStream) {
        return null;
      }

      // When preferTextBased is active and the default is an embedded text-based
      // sub, return it directly — the caller will extract via the pipeline.
      if (
        effectivePreferText &&
        defaultStream.type === 'embedded' &&
        !isImageBasedSubtitle(defaultStream.codec)
      ) {
        return defaultStream;
      }

      const extracted =
        await SubtitleStreamPicker.getSubtitleDetailsWithExtractedPath(
          lineupItem,
          defaultStream,
        );
      if (extracted) {
        return extracted;
      }

      if (
        defaultStream &&
        (defaultStream.type === 'external' ||
          (defaultStream.type === 'embedded' &&
            isImageBasedSubtitle(defaultStream.codec)))
      ) {
        return defaultStream;
      }

      return null;
    }

    case 'by_language': {
      if (!subtitleStreams || subtitleStreams.length === 0) {
        return null;
      }

      const effectivePreferText =
        hints?.preferTextBased || action.preferTextBased;

      const candidates = [...subtitleStreams];
      if (effectivePreferText) {
        candidates.sort((a, b) => {
          const aImage = isImageBasedSubtitle(a.codec) ? 1 : 0;
          const bImage = isImageBasedSubtitle(b.codec) ? 1 : 0;
          return aImage - bImage;
        });
      }

      for (const lang of action.languages) {
        const langLower = lang.toLowerCase();
        for (const stream of candidates) {
          // Language match
          if (
            stream.languageCodeISO6392?.toLowerCase() !== langLower &&
            stream.languageCodeISO6391?.toLowerCase() !== langLower &&
            stream.language?.toLowerCase() !== langLower
          ) {
            continue;
          }

          // Filter type check
          if (action.filterType === 'forced' && !stream.forced) {
            continue;
          }
          if (action.filterType === 'default' && !stream.default) {
            continue;
          }

          // External check
          if (!action.allowExternal && stream.type === 'external') {
            continue;
          }

          // Image-based check
          if (!action.allowImageBased && isImageBasedSubtitle(stream.codec)) {
            continue;
          }

          // When preferTextBased is active and we have an embedded text-based
          // sub, return it directly — the caller will extract via the pipeline.
          if (
            effectivePreferText &&
            !isImageBasedSubtitle(stream.codec) &&
            stream.type === 'embedded'
          ) {
            return stream;
          }

          // For embedded text-based subs, verify extraction
          if (
            !isImageBasedSubtitle(stream.codec) &&
            stream.type === 'embedded'
          ) {
            const extracted =
              await SubtitleStreamPicker.getSubtitleDetailsWithExtractedPath(
                lineupItem,
                stream,
              );
            if (extracted) {
              return extracted;
            }
            continue;
          }

          return stream;
        }
      }

      return null;
    }
  }
}

function isImageBasedSubtitle(codec: string): boolean {
  const imageCodecs = [
    'hdmv_pgs_subtitle',
    'pgssub',
    'dvd_subtitle',
    'dvdsub',
    'dvbsub',
  ];
  return imageCodecs.includes(codec.toLowerCase());
}
