import type { EmbyItem } from '@tunarr/types/emby';
import { isNonEmptyString } from '../util/index.ts';
import type { Canonicalizer } from './Canonicalizer.ts';

export class EmbyItemCanonicalizer implements Canonicalizer<EmbyItem> {
  getCanonicalId(t: EmbyItem): string {
    if (!isNonEmptyString(t.Etag)) {
      throw new Error(`Emby item ${t.Id} has no etag.`);
    }

    return t.Etag;
  }
}
