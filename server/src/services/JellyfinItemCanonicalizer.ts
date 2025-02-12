import type { JellyfinItem } from '@tunarr/types/jellyfin';
import { isNonEmptyString } from '../util/index.ts';
import type { Canonicalizer } from './Canonicalizer.ts';

export class JellyfinItemCanonicalizer implements Canonicalizer<JellyfinItem> {
  getCanonicalId(t: JellyfinItem): string {
    if (!isNonEmptyString(t.Etag)) {
      throw new Error(`Jellyfin item ${t.Id} has no etag.`);
    }

    return t.Etag;
  }
}
