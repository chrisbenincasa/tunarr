import { describe, expect, test } from 'vitest';
import dayjs from './dayjs.ts';
import { parseAirDate } from './airDate.ts';

/**
 * The parser these replaced. Kept here so the widening can be proven safe
 * rather than asserted: every input the strict form accepted must still parse
 * to the same instant, or release dates would move for programs that were
 * working before.
 */
const strictImplementation = (value: string) =>
  dayjs(value, [`YYYY-MM-DDTHH:mm:ssZ`, `YYYY-MM-DD`], true);

/** The offset the running machine would itself write for this date. */
const localOffset = dayjs('2020-05-04').format('Z');

describe('parseAirDate', () => {
  describe('offsets other than the server’s own', () => {
    /**
     * The bug this fixes. Air dates are stored as `dayjs(d).format()`, which
     * embeds the writing machine's offset, and the strict parser only accepted
     * an offset equal to the reading machine's. Changing the server timezone,
     * moving the database or setting TZ on a container that had been running
     * UTC therefore emptied every release date at once.
     *
     * These offsets are fixed rather than derived precisely because they are
     * foreign to whatever zone the suite runs in — that is the case that broke.
     */
    test.each([
      '-08:00',
      '-05:00',
      '-04:00',
      '+00:00',
      '+01:00',
      '+05:30',
      '+09:00',
      '+12:45',
    ])('parses an air date written at %s', (offset) => {
      const value = `2020-05-04T00:00:00${offset}`;

      const parsed = parseAirDate(value);

      expect(parsed).toBeDefined();
      // Same instant the offset denotes, independent of where this runs.
      expect(+parsed!).toBe(Date.parse(value));
    });

    test('all offsets agree on the instant they name', () => {
      const instants = ['-05:00', '+00:00', '+05:30'].map(
        (o) => +parseAirDate(`2020-05-04T00:00:00${o}`)!,
      );

      expect(new Set(instants).size).toBe(3);
    });
  });

  describe('forms the strict parser never accepted anywhere', () => {
    test.each([
      ['literal Z suffix', '2020-05-04T10:00:00Z'],
      ['no offset at all', '2020-05-04T10:00:00'],
      ['milliseconds', '2020-05-04T10:00:00.000Z'],
    ])('parses %s', (_label, value) => {
      expect(strictImplementation(value).isValid()).toBe(false);
      expect(parseAirDate(value)).toBeDefined();
    });
  });

  describe('the widening does not move dates that already worked', () => {
    test.each([
      '2020-05-04',
      '1970-01-01',
      '2020-12-31',
      `2020-05-04T00:00:00${localOffset}`,
      `2020-12-31T23:00:00${dayjs('2020-12-31').format('Z')}`,
    ])('%s parses to the same instant as before', (value) => {
      const before = strictImplementation(value);
      // Guard: if this stopped being an input the strict parser accepts, the
      // case is no longer testing what it claims to.
      expect(before.isValid()).toBe(true);

      const after = parseAirDate(value);

      expect(after).toBeDefined();
      expect(+after!).toBe(+before);
      expect(after!.year()).toBe(before.year());
    });
  });

  describe('absent and unparseable input', () => {
    test.each([
      ['null', null],
      ['undefined', undefined],
      ['empty string', ''],
      ['whitespace', '   '],
      ['not a date', 'not a date'],
    ])('returns undefined for %s', (_label, value) => {
      // The callers distinguish these with `parsed ? ... : null`, so an invalid
      // dayjs instance here would read as a valid date.
      expect(parseAirDate(value)).toBeUndefined();
    });
  });
});
