import { inArray } from 'drizzle-orm';
import type { DrizzleDBAccess } from '../../db/schema/index.ts';
import { ProgramSubtitles } from '../../db/schema/ProgramSubtitles.ts';
import { LanguageService } from '../../services/LanguageService.ts';

/** Stored when a subtitle reports no language. */
const UnknownLanguage = 'unknown';

/**
 * Languages of each program's stored subtitles. These include local sidecar
 * files, which never appear among a program's media streams.
 */
export function getStoredSubtitleLanguages(
  drizzle: DrizzleDBAccess,
  programIds: string[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  if (programIds.length === 0) {
    return result;
  }

  const rows = drizzle
    .select({
      programId: ProgramSubtitles.programId,
      language: ProgramSubtitles.language,
    })
    .from(ProgramSubtitles)
    .where(inArray(ProgramSubtitles.programId, programIds))
    .all();

  for (const row of rows) {
    const language = LanguageService.normalizeLanguageCode(row.language);
    if (!language || language === UnknownLanguage) {
      continue;
    }
    const languages = result.get(row.programId) ?? [];
    if (!languages.includes(language)) {
      languages.push(language);
    }
    result.set(row.programId, languages);
  }
  return result;
}
