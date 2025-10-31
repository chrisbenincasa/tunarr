import type {
  ProgramGroupingSearchDocument,
  ProgramSearchDocument,
  TerminalProgramSearchDocument,
} from '../services/MeilisearchService.ts';

export function isTerminalProgramDocument(
  doc: ProgramSearchDocument,
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
  doc: ProgramSearchDocument,
): doc is ProgramGroupingSearchDocument {
  return !isTerminalProgramDocument(doc);
}

export function isShowProgramSearchDocument(
  doc: ProgramSearchDocument,
): doc is ProgramGroupingSearchDocument<'show'> {
  return doc.type === 'show';
}
