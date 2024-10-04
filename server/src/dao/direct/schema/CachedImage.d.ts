import { Selectable } from 'kysely';

export interface CachedImageTable {
  hash: string;
  mimeType: string | null;
  url: string;
}

export type CachedImage = Selectable<CachedImageTable>;
