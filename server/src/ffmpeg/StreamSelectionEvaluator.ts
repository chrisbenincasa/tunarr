import type {
  StreamSelectionProfile,
  AudioAction,
  SubtitleAction,
} from '@tunarr/types/schemas';
import type { NonEmptyArray } from 'ts-essentials';
import type {
  AudioStreamDetails,
  SubtitleStreamDetails,
} from '../stream/types.ts';
import type { ContentBackedStreamLineupItem } from '../db/derived_types/StreamLineup.ts';
import type {
  CelEvaluationService,
  StreamSelectionCelContext,
} from '../services/CelEvaluationService.ts';
import { SubtitleStreamPicker } from './SubtitleStreamPicker.ts';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';

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
        .filter((l): l is string => !!l),
    ),
  ];

  const subtitleLanguages = [
    ...new Set(
      (subtitleStreams ?? [])
        .map(
          (s) => s.languageCodeISO6392 ?? s.languageCodeISO6391 ?? s.language,
        )
        .filter((l): l is string => !!l),
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

export async function evaluateStreamSelectionProfile(
  profile: StreamSelectionProfile,
  audioStreams: NonEmptyArray<AudioStreamDetails>,
  subtitleStreams: SubtitleStreamDetails[] | undefined,
  celService: CelEvaluationService,
  celContext: StreamSelectionCelContext,
  lineupItem: ContentBackedStreamLineupItem,
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

function resolveAudioAction(
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
      return (
        audioStreams.find((s) => s.selected) ??
        audioStreams.find((s) => s.default) ??
        audioStreams[0]
      );
    }

    case 'by_title': {
      const titleLower = action.titleContains.toLowerCase();
      const match = audioStreams.find((s) =>
        s.title?.toLowerCase().includes(titleLower),
      );
      return (
        match ??
        audioStreams.find((s) => s.selected) ??
        audioStreams.find((s) => s.default) ??
        audioStreams[0]
      );
    }

    case 'default': {
      return (
        audioStreams.find((s) => s.selected) ??
        audioStreams.find((s) => s.default) ??
        audioStreams[0]
      );
    }
  }
}

async function resolveSubtitleAction(
  action: SubtitleAction,
  subtitleStreams: SubtitleStreamDetails[] | undefined,
  lineupItem: ContentBackedStreamLineupItem,
): Promise<SubtitleStreamDetails | null> {
  switch (action.type) {
    case 'disable':
      return null;

    case 'default': {
      if (!subtitleStreams || subtitleStreams.length === 0) {
        return null;
      }
      const defaultStream = subtitleStreams.find((s) => s.default);
      if (!defaultStream) {
        return null;
      }
      const extracted =
        await SubtitleStreamPicker.getSubtitleDetailsWithExtractedPath(
          lineupItem,
          defaultStream,
        );
      return extracted ?? defaultStream;
    }

    case 'by_language': {
      if (!subtitleStreams || subtitleStreams.length === 0) {
        return null;
      }

      for (const lang of action.languages) {
        const langLower = lang.toLowerCase();
        for (const stream of subtitleStreams) {
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
