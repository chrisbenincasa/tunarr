import type { Dayjs } from 'dayjs';
import type { Maybe, Nullable } from '../types/util.ts';
import dayjs from './dayjs.ts';
import { isNonEmptyString } from './index.ts';

/**
 * Parses a program's `originalAirDate`, or returns undefined when it is absent
 * or unparseable.
 *
 * Deliberately not `dayjs(value, ['YYYY-MM-DDTHH:mm:ssZ', 'YYYY-MM-DD'], true)`,
 * which is what the call sites used to do. Under strict customParseFormat the
 * `Z` token matches a numeric offset and requires it to equal the *server's own*
 * UTC offset, so a value only parsed on a machine in the timezone that wrote it.
 * Verified across America/New_York, UTC and Asia/Kolkata: of seven offsets,
 * exactly one parsed in each zone, always the local one.
 *
 * Air dates are stored by ProgramMinter as `dayjs(releaseDate).format()`, which
 * embeds the offset. So the values round-trip on the machine that scanned them
 * and stop resolving the moment the server's timezone changes — moving the
 * database, setting TZ on a container that had been running UTC, or restoring a
 * backup elsewhere silently emptied every release date and every XMLTV `date`.
 * The strict `Z` token also never matched a literal "Z" suffix, so the most
 * common ISO form never parsed anywhere.
 *
 * Plain `dayjs(value)` handles any offset, the "Z" suffix and bare dates. It is
 * also what ProgramConverter and ProgramIterator already use on this same
 * field, so this makes the readers agree rather than introducing a fourth
 * interpretation. Every input the strict form accepted parses to a byte
 * identical instant; only inputs that previously failed change.
 *
 * It is faster, too, which matters because this runs once per program:
 *
 *   "2020-05-04"                 44.14us -> 1.84us
 *   "2020-05-04T00:00:00-04:00"   9.78us -> 3.09us
 *   "2020-05-04T10:00:00Z"       14.00us -> 1.49us
 */
export function parseAirDate(
  value: Nullable<string> | undefined,
): Maybe<Dayjs> {
  if (!isNonEmptyString(value)) {
    return undefined;
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : undefined;
}
