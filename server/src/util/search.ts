import type {
  ProgramGroupingSearchDocument,
  ProgramSearchDocument,
  TerminalProgramSearchDocument,
} from '../services/MeilisearchService.ts';

export function isTerminalProgramDocument(
  doc: Pick<ProgramSearchDocument, 'type'>,
): doc is TerminalProgramSearchDocument {
  switch (doc.type) {
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

export function isProgramGroupingDocument(
  doc: Pick<ProgramSearchDocument, 'type'>,
): doc is ProgramGroupingSearchDocument {
  return !isTerminalProgramDocument(doc);
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
      isProgramGroupingDocument(doc)
        ? !groupingIds.has(doc.id)
        : !programIds.has(doc.id),
    )
    .map((doc) => doc.id);
}
