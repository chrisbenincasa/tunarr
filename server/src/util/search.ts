import type {
  ProgramGroupingSearchDocument,
  ProgramSearchDocument,
  TerminalProgramSearchDocument,
} from '../services/MeilisearchService.ts';

export function isTerminalProgramType(
  type: ProgramSearchDocument['type'],
): boolean {
  switch (type) {
    case 'movie':
    case 'episode':
    case 'track':
    case 'music_video':
    case 'other_video':
      return true;
    case 'show':
    case 'season':
    case 'artist':
    case 'album':
      return false;
  }
}

export function isTerminalProgramDocument(
  doc: ProgramSearchDocument,
): doc is TerminalProgramSearchDocument {
  return isTerminalProgramType(doc.type);
}

export function isProgramGroupingDocument(
  doc: ProgramSearchDocument,
): doc is ProgramGroupingSearchDocument {
  return !isTerminalProgramType(doc.type);
}

/**
 * Returns the ids of search documents whose program or grouping row is gone
 * from the DB. These documents are stale. They still count toward the index's
 * totals but can never be returned as results.
 */
export function findDanglingSearchDocumentIds(
  docs: readonly Pick<ProgramSearchDocument, 'id' | 'type'>[],
  programIds: ReadonlySet<string>,
  groupingIds: ReadonlySet<string>,
): string[] {
  return docs
    .filter((doc) =>
      isTerminalProgramType(doc.type)
        ? !programIds.has(doc.id)
        : !groupingIds.has(doc.id),
    )
    .map((doc) => doc.id);
}
