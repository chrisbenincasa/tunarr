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
import { LanguageService } from '../services/LanguageService.ts';
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
  audioStreams: readonly AudioStreamDetails[],
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

function findMatchingRule(
  profile: StreamSelectionProfile,
  celService: CelEvaluationService,
  celContext: StreamSelectionCelContext,
): StreamSelectionProfile['rules'][number] | undefined {
  for (const rule of profile.rules) {
    if (celService.evaluate(rule.condition, celContext)) {
      logger.debug(
        'Stream selection rule matched: %s (condition: %s)',
        rule.label ?? '(unlabeled)',
        rule.condition,
      );
      return rule;
    }
  }
  return undefined;
}

export async function evaluateStreamSelectionProfile(
  profile: StreamSelectionProfile,
  audioStreams: NonEmptyArray<AudioStreamDetails>,
  subtitleStreams: SubtitleStreamDetails[] | undefined,
  celService: CelEvaluationService,
  celContext: StreamSelectionCelContext,
  lineupItem: ContentBackedStreamLineupItem,
  hints?: StreamSelectionHints,
): Promise<StreamSelectionResult> {
  const rule = findMatchingRule(profile, celService, celContext);
  if (!rule) {
    logger.debug('No stream selection rule matched, using defaults');
    return {
      audioStream: audioStreams[0],
      subtitleStream: null,
    };
  }

  return {
    audioStream: resolveAudioAction(rule.audioAction, audioStreams),
    subtitleStream: await resolveSubtitleAction(
      rule.subtitleAction,
      subtitleStreams,
      lineupItem,
      hints,
    ),
  };
}

/**
 * Resolve only the subtitle stream, for callers that have no audio to select.
 * Passthrough output reuses the source audio as-is, so requiring an audio
 * stream here would drop subtitles from content that has none.
 */
export async function evaluateSubtitleSelection(
  profile: StreamSelectionProfile,
  subtitleStreams: SubtitleStreamDetails[] | undefined,
  celService: CelEvaluationService,
  celContext: StreamSelectionCelContext,
  lineupItem: ContentBackedStreamLineupItem,
  hints?: StreamSelectionHints,
): Promise<SubtitleStreamDetails | null> {
  const rule = findMatchingRule(profile, celService, celContext);
  if (!rule) {
    logger.debug('No stream selection rule matched, selecting no subtitles');
    return null;
  }

  return await resolveSubtitleAction(
    rule.subtitleAction,
    subtitleStreams,
    lineupItem,
    hints,
  );
}

export type LanguageTaggedStream = {
  language?: string;
  languageCodeISO6391?: string;
  languageCodeISO6392?: string;
};

/**
 * Match a stream against a requested language.
 *
 * The stream's language is resolved with the same precedence buildCelContext
 * uses (ISO 639-2 > ISO 639-1 > free-form), so a stream is only ever treated
 * as being in one language. Comparison goes through LanguageService so that
 * the two ISO 639-2 code sets are interchangeable — a stored preference of
 * "ger" must match a stream that Jellyfin or ffprobe tagged "deu".
 */
export function streamMatchesLanguage(
  stream: LanguageTaggedStream,
  language: string,
): boolean {
  const streamLanguage =
    stream.languageCodeISO6392 ?? stream.languageCodeISO6391 ?? stream.language;
  return LanguageService.codesMatch(streamLanguage, language);
}

export function resolveAudioAction(
  action: AudioAction,
  audioStreams: NonEmptyArray<AudioStreamDetails>,
): AudioStreamDetails {
  switch (action.type) {
    case 'by_language': {
      for (const lang of action.languages) {
        let matches = audioStreams.filter((stream) =>
          streamMatchesLanguage(stream, lang),
        );

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

/**
 * Order candidates so text-based subs come first. The sort is stable, so
 * streams keep their original relative order within each group.
 */
function sortSubtitleCandidates(
  subtitleStreams: SubtitleStreamDetails[],
  preferTextBased: boolean | undefined,
): NonEmptyArray<SubtitleStreamDetails> {
  const candidates = [
    ...subtitleStreams,
  ] as NonEmptyArray<SubtitleStreamDetails>;
  if (preferTextBased) {
    candidates.sort(
      (a, b) =>
        (isImageBasedSubtitle(a.codec) ? 1 : 0) -
        (isImageBasedSubtitle(b.codec) ? 1 : 0),
    );
  }
  return candidates;
}

async function resolveSubtitleAction(
  action: SubtitleAction,
  subtitleStreams: SubtitleStreamDetails[] | undefined,
  lineupItem: ContentBackedStreamLineupItem,
  hints?: StreamSelectionHints,
): Promise<SubtitleStreamDetails | null> {
  // Sorting is a user preference, so the profile field and the caller hint both
  // feed it. Skipping extraction is a caller capability — only a caller that can
  // mux an embedded stream straight from the container may ask for it, so that
  // is driven by the hint alone. A profile must never send an unextracted stream
  // to a caller that needs a real file path.
  const mayReturnUnextracted = hints?.preferTextBased ?? false;

  switch (action.type) {
    case 'disable':
      return null;

    case 'default': {
      if (!subtitleStreams || subtitleStreams.length === 0) {
        return null;
      }

      const candidates = sortSubtitleCandidates(
        subtitleStreams,
        hints?.preferTextBased || action.preferTextBased,
      );

      // Matches the legacy picker: with no default-flagged stream, fall back to
      // the first candidate rather than dropping subtitles. External subs
      // frequently carry no default flag.
      const defaultStream = candidates.find((s) => s.default) ?? candidates[0];

      if (
        mayReturnUnextracted &&
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

      // Extraction only applies to embedded text subs. Anything else is already
      // usable as-is.
      if (
        defaultStream.type === 'external' ||
        isImageBasedSubtitle(defaultStream.codec)
      ) {
        return defaultStream;
      }

      return null;
    }

    case 'by_language': {
      if (
        action.filterType === 'none' ||
        !subtitleStreams ||
        subtitleStreams.length === 0
      ) {
        return null;
      }

      const candidates = sortSubtitleCandidates(
        subtitleStreams,
        hints?.preferTextBased || action.preferTextBased,
      );

      for (const lang of action.languages) {
        for (const stream of candidates) {
          if (!streamMatchesLanguage(stream, lang)) {
            continue;
          }

          if (action.filterType === 'forced' && !stream.forced) {
            continue;
          }
          if (action.filterType === 'default' && !stream.default) {
            continue;
          }

          if (!action.allowExternal && stream.type === 'external') {
            continue;
          }

          if (!action.allowImageBased && isImageBasedSubtitle(stream.codec)) {
            continue;
          }

          const isEmbeddedText =
            stream.type === 'embedded' && !isImageBasedSubtitle(stream.codec);

          if (!isEmbeddedText) {
            return stream;
          }

          if (mayReturnUnextracted) {
            return stream;
          }

          const extracted =
            await SubtitleStreamPicker.getSubtitleDetailsWithExtractedPath(
              lineupItem,
              stream,
            );
          if (extracted) {
            return extracted;
          }
        }
      }

      return null;
    }
  }
}
