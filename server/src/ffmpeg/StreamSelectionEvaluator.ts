import type { SubtitleFilter } from '@tunarr/types';
import type {
  AudioAction,
  StreamSelectionProfile,
  SubtitleAction,
  SubtitleActionByLanguage,
  SubtitleLanguagePreference,
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
import { isImageBasedSubtitle } from '../stream/util.ts';
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
      return selectDefautlAudioStream(audioStreams);
    }

    case 'by_title': {
      const titleLower = action.titleContains.toLowerCase();
      const match = audioStreams.find((s) =>
        s.title?.toLowerCase().includes(titleLower),
      );
      return match ?? selectDefautlAudioStream(audioStreams);
    }

    case 'default':
      return selectDefautlAudioStream(audioStreams);
  }
}

function selectDefautlAudioStream(
  audioStreams: NonEmptyArray<AudioStreamDetails>,
) {
  return (
    audioStreams.find((s) => s.selected) ??
    audioStreams.find((s) => s.default) ??
    audioStreams[0]
  );
}

type ResolvedSubtitleLanguagePreference = {
  language: string;
  filterType: SubtitleFilter;
  allowImageBased: boolean;
  allowExternal: boolean;
};

/**
 * Resolves one entry of a by_language subtitle action against the
 * action-level defaults. A bare string entry inherits all of them.
 */
function normalizeSubtitleLanguagePreference(
  entry: string | SubtitleLanguagePreference,
  defaults: Omit<SubtitleActionByLanguage, 'type' | 'languages'>,
): ResolvedSubtitleLanguagePreference {
  if (typeof entry === 'string') {
    return {
      language: entry,
      filterType: defaults.filterType,
      allowImageBased: defaults.allowImageBased,
      allowExternal: defaults.allowExternal,
    };
  }

  return {
    language: entry.language,
    filterType: entry.filterType ?? defaults.filterType,
    allowImageBased: entry.allowImageBased ?? defaults.allowImageBased,
    allowExternal: entry.allowExternal ?? defaults.allowExternal,
  };
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

      // Falls back to the first stream when none is marked default, matching
      // both SubtitleStreamPicker.pickSubtitles and selectDefautlAudioStream.
      const candidate =
        subtitleStreams.find((s) => s.default) ?? subtitleStreams[0];
      if (!candidate) {
        return null;
      }

      // Embedded text-based subs are only usable once extracted to a sidecar.
      if (
        !isImageBasedSubtitle(candidate.codec) &&
        candidate.type === 'embedded'
      ) {
        return (
          (await SubtitleStreamPicker.getSubtitleDetailsWithExtractedPath(
            lineupItem,
            candidate,
          )) ?? null
        );
      }

      return candidate;
    }

    case 'by_language': {
      if (!subtitleStreams || subtitleStreams.length === 0) {
        return null;
      }

      for (const entry of action.languages) {
        const pref = normalizeSubtitleLanguagePreference(entry, action);
        if (pref.filterType === 'none') {
          continue;
        }

        const langLower = pref.language.toLowerCase();
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
          if (pref.filterType === 'forced' && !stream.forced) {
            continue;
          }
          if (pref.filterType === 'default' && !stream.default) {
            continue;
          }

          // External check
          if (!pref.allowExternal && stream.type === 'external') {
            continue;
          }

          // Image-based check
          if (!pref.allowImageBased && isImageBasedSubtitle(stream.codec)) {
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
