import { isTerminalItemType } from '@tunarr/types';
import type {
  ProgramGroupingSearchDocument,
  ProgramSearchDocument,
  TerminalProgramSearchDocument,
} from '../services/MeilisearchService.ts';

export function isTerminalProgramDocument(
  doc: ProgramSearchDocument,
): doc is TerminalProgramSearchDocument {
  return isTerminalItemType(doc.type);
}

export function isProgramGroupingDocument(
  doc: ProgramSearchDocument,
): doc is ProgramGroupingSearchDocument {
  return !isTerminalItemType(doc.type);
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
      isTerminalItemType(doc.type)
        ? !programIds.has(doc.id)
        : !groupingIds.has(doc.id),
    )
    .map((doc) => doc.id);
}
