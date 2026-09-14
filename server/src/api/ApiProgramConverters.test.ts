import { describe, expect, test } from 'vitest';
import dayjs from '../util/dayjs.ts';
import { parseAirDate } from './ApiProgramConverters.ts';

/**
 * parseAirDate replaced `dayjs(value, [fmtA, fmtB], true)` for performance —
 * that call was roughly half of the main thread stall while saving a large
 * lineup. These pin the replacement to the behaviour of the call it replaced,
 * because a faster parser that accepts or rejects different strings would
 * silently change what release dates and years end up in the database.
 */
const originalImplementation = (value: unknown) =>
  dayjs(value as never, [`YYYY-MM-DDTHH:mm:ssZ`, `YYYY-MM-DD`], true);

const CASES: [string, unknown][] = [
  ['null', null],
  ['undefined', undefined],
  ['empty string', ''],
  ['whitespace', '   '],
  ['plain date', '2020-05-04'],
  ['iso with Z', '2020-05-04T10:00:00Z'],
  ['iso with negative offset', '2020-05-04T10:00:00-04:00'],
  ['iso with positive offset', '2020-05-04T10:00:00+05:30'],
  ['end of year', '1999-12-31'],
  ['non-padded month and day', '2020-5-4'],
  ['datetime with no offset', '2020-05-04T10:00:00'],
  ['day first', '04-05-2020'],
  ['not a date at all', 'not a date'],
  ['impossible month and day', '2020-13-45'],
  ['compact form', '20200504'],
];

describe('parseAirDate', () => {
  test.each(CASES)(
    'agrees with the multi-format dayjs call for %s',
    (_label, input) => {
      const before = originalImplementation(input);
      const after = parseAirDate(input as string | null | undefined);

      expect(after !== undefined).toBe(before.isValid());

      if (before.isValid() && after !== undefined) {
        expect(+after).toBe(+before);
        expect(after.year()).toBe(before.year());
      }
    },
  );

  /**
   * Documents pre-existing quirks rather than endorsing them.
   *
   * Two of them. Under strict customParseFormat the `Z` token matches a numeric
   * offset, not a literal "Z", so the most common ISO form does not parse and
   * the program silently gets a null release date. And a numeric offset only
   * parses when it equals the server's own UTC offset — confirmed across
   * America/New_York, UTC and Asia/Kolkata — so a deployment in one zone drops
   * every air date written in another.
   *
   * parseAirDate reproduces both exactly; it was a performance change, not a
   * behaviour change. These cases exist so that anyone fixing the underlying
   * bug sees what currently happens.
   *
   * The offsets are derived from the running timezone rather than hardcoded.
   * A literal `-04:00` passes only where it was written: it succeeds in
   * America/New_York and fails in CI, which runs UTC.
   */
  const localOffset = dayjs('2020-05-04').format('Z');
  // Nepal time, picked because no CI runner is plausibly set to it. The
  // fallback covers the case where it somehow is.
  const foreignOffset = localOffset === '+05:45' ? '+09:00' : '+05:45';

  test.each([
    ['plain date', '2020-05-04', true],
    ['offset matching the server', `2020-05-04T10:00:00${localOffset}`, true],
    [
      'offset differing from the server',
      `2020-05-04T10:00:00${foreignOffset}`,
      false,
    ],
    ['literal Z suffix', '2020-05-04T10:00:00Z', false],
    ['no offset at all', '2020-05-04T10:00:00', false],
  ])('%s parses: %s -> %s', (_label, input, shouldParse) => {
    expect(parseAirDate(input as string) !== undefined).toBe(shouldParse);
  });

  test('returns undefined rather than an invalid dayjs for absent input', () => {
    // The caller distinguishes these with `parsed ? ... : null`, so returning
    // an invalid instance instead of undefined would read as a valid date.
    expect(parseAirDate(null)).toBeUndefined();
    expect(parseAirDate(undefined)).toBeUndefined();
  });
});
