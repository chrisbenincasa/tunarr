import type {
  ProgramGroupingSearchDocument,
  ProgramSearchDocument,
} from '../services/MeilisearchService.ts';

export function isProgramGroupingDocument(
  doc: ProgramSearchDocument,
): doc is ProgramGroupingSearchDocument {
  switch (doc.type) {
    case 'show':
    case 'season':
    case 'artist':
    case 'album':
      return true;
    default:
      return false;
  }
}

export function isShowProgramSearchDocument(
  doc: ProgramSearchDocument,
): doc is ProgramGroupingSearchDocument<'show'> {
  return doc.type === 'show';
}
