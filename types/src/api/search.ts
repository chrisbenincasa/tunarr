import { z } from 'zod/v4';
import type { MediaSourceLibrary } from '../MediaSourceSettings.js';
import {
  SearchField,
  SearchFilterQuerySchema,
  SearchRequest,
} from '../schemas/SearchRequest.js';

// A PlexSearch but with a reference to the
// library it is for.
export type LibrarySearchRequest = {
  search: SearchRequest;
  libraryId: string;
};

export type SearchFieldSpec<Key extends string = string> = {
  key: Key;
  type: SearchField['type'];
  name: string;
  visibleForLibraryTypes:
    | 'all'
    | ReadonlyArray<MediaSourceLibrary['mediaType']>;
};

z.globalRegistry.add(SearchFilterQuerySchema, { id: 'SearchFilter' });
