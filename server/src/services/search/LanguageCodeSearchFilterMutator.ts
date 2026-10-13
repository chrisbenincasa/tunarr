import { seq } from '@tunarr/shared/util';
import type { SearchFilterValueNode } from '@tunarr/types/schemas';
import { LanguageService } from '../LanguageService.ts';
import type { SearchFilterValueMutator } from './SearchFilterValueMutator.ts';

/**
 * Virtual field keys for the language facets in a saved filter. These are what
 * a user's smart collection carries; the rename to the index fields
 * (`audioLanguages` / `subtitleLanguages`) happens later, in searchUtil.
 */
const LanguageFieldKeys = new Set(['audio_language', 'subtitle_language']);

/**
 * Normalize every language value in a saved filter to ISO 639-2/T before it
 * reaches the index. Stored codes can be ISO 639-2 /B (``ger``), which the
 * language backfill converted to /T (``deu``); without rewriting the values
 * here, a saved ``audioLanguages = "ger"`` filter silently matches nothing
 * after the upgrade (#2044). Unresolvable values pass through unchanged, so
 * they fail the same way they do on write. ``=``, ``!=``, ``in`` and ``not in``
 * differ only in operator and value list, so one value transform covers all.
 */
export class LanguageCodeSearchFilterMutator
  implements SearchFilterValueMutator
{
  appliesTo(op: SearchFilterValueNode): boolean {
    return (
      LanguageFieldKeys.has(op.fieldSpec.key) &&
      (op.fieldSpec.type === 'string' || op.fieldSpec.type === 'faceted_string')
    );
  }

  mutate(op: SearchFilterValueNode): SearchFilterValueNode {
    if (
      op.fieldSpec.type !== 'string' &&
      op.fieldSpec.type !== 'faceted_string'
    ) {
      return op;
    }

    // Only the values change; the virtual key is kept (the index-field rename
    // is done later by the search pipeline).
    return {
      ...op,
      fieldSpec: {
        ...op.fieldSpec,
        value: seq.collect(op.fieldSpec.value, (code) =>
          LanguageService.normalizeLanguageCode(code),
        ),
      },
    };
  }
}
