/**
 * Tests for InfiniteScheduleGenerator.
 *
 * Layers:
 *  1. Unit  — single-slot behaviour (fill modes, padding, flex preference)
 *  2. Integration — multi-slot rotation, anchored slots, anchorDays filtering
 *  3. Timezone / DST — UTC-offset math, spring-forward, fall-back
 *  4. Filler injection — relaxed/strict pre/head/tail, fallback filler
 *  5. State persistence — second preview run continues from saved iterator state
 *
 * The `preview()` method drives all tests because it takes a fully-constructed
 * schedule object and never touches the database, so no InfiniteScheduleDB mock
 * is needed — only SlotSchedulerHelper needs to be stubbed.
 */
import type { ProgramWithRelationsOrm } from '@/db/schema/derivedTypes.js';
import type { InfiniteSchedule } from '@/db/schema/InfiniteSchedule.js';
import type { InfiniteScheduleSlot } from '@/db/schema/InfiniteScheduleSlot.js';
import type { InfiniteScheduleSlotState } from '@/db/schema/InfiniteScheduleSlotState.js';
import { createFakeProgramOrm } from '@/testing/fakes/entityCreators.js';
import dayjs from '@/util/dayjs.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { v4 } from 'uuid';
import type { InfiniteScheduleDB } from '@/db/InfiniteScheduleDB.js';
import {
  InfiniteScheduleGenerator,
  type GenerationResult,
  type SlotStateUpdate,
} from './InfiniteScheduleGenerator.js';
import type { SlotSchedulerHelper } from './SlotSchedulerHelper.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// ── Logger stub ───────────────────────────────────────────────────────────────

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(),
} as unknown as Logger;
(mockLogger.child as ReturnType<typeof vi.fn>).mockReturnValue(mockLogger);

// ── Program factory ───────────────────────────────────────────────────────────

function makePrograms(
  n: number,
  opts: { duration?: number; type?: 'movie' | 'episode'; prefix?: string } = {},
): ProgramWithRelationsOrm[] {
  const { duration = HOUR_MS, type = 'movie', prefix = 'prog' } = opts;
  return Array.from({ length: n }, (_, i) =>
    createFakeProgramOrm({ uuid: `${prefix}-${i}`, type, duration }),
  );
}

// ── Slot / schedule factories ─────────────────────────────────────────────────

let _slotIndex = 0;

/** Base slot skeleton — callers supply slotType and any overrides. */
function makeSlot(
  partial: Partial<InfiniteScheduleSlot> & {
    slotType: InfiniteScheduleSlot['slotType'];
  },
): InfiniteScheduleSlot & { state: null } {
  return {
    uuid: v4(),
    scheduleUuid: '',
    slotIndex: _slotIndex++,
    showId: null,
    customShowId: null,
    fillerListId: null,
    redirectChannelId: null,
    smartCollectionId: null,
    slotConfig: { order: 'next', direction: 'asc' },
    anchorTime: null,
    anchorMode: null,
    anchorDays: null,
    weight: 1,
    cooldownMs: 0,
    fillMode: 'fill',
    fillValue: null,
    padMs: null,
    padToMultiple: null,
    fillerConfig: null,
    createdAt: null,
    updatedAt: null,
    ...partial,
    state: null,
  };
}

/** Custom-show slot — programs are loaded by customShowId in the helper mock. */
function makeCustomShowSlot(
  customShowId: string,
  partial: Partial<InfiniteScheduleSlot> = {},
): InfiniteScheduleSlot & { state: null } {
  return makeSlot({ slotType: 'custom-show', customShowId, ...partial });
}

type SlotWithOptionalState = InfiniteScheduleSlot & {
  state: InfiniteScheduleSlotState | null;
};

/** Build a minimal schedule suitable for passing to `preview()`. */
function makeSchedule(
  slots: SlotWithOptionalState[],
  partial: Partial<InfiniteSchedule> = {},
): Parameters<InstanceType<typeof InfiniteScheduleGenerator>['preview']>[0] {
  return {
    name: 'test-schedule',
    padToMultiple: 0,
    flexPreference: 'end',
    timeZoneOffset: 0,
    slotPlaybackOrder: 'ordered',
    bufferDays: 7,
    bufferThresholdDays: 2,
    enabled: true,
    createdAt: null,
    updatedAt: null,
    ...partial,
    slots,
    state: null,
  };
}

// ── Helper mock factory ───────────────────────────────────────────────────────

/**
 * Build a minimal SlotSchedulerHelper mock.
 * `programsByCustomShowId` is the primary map used in most tests.
 * `byShowId` and `byFillerListId` are opt-in for show / filler tests.
 */
function makeHelper(
  programsByCustomShowId: Record<string, ProgramWithRelationsOrm[]> = {},
  extras: {
    byShowId?: Record<string, ProgramWithRelationsOrm[]>;
    byFillerListId?: Record<string, ProgramWithRelationsOrm[]>;
  } = {},
): SlotSchedulerHelper {
  return {
    materializeCustomShowPrograms: vi
      .fn()
      .mockImplementation((ids: Set<string>) =>
        Promise.resolve(
          Object.fromEntries(
            [...ids].map((id) => [id, programsByCustomShowId[id] ?? []]),
          ),
        ),
      ),
    materializeShows: vi.fn().mockImplementation((ids: Set<string>) =>
      Promise.resolve([...ids].flatMap((id) => extras.byShowId?.[id] ?? [])),
    ),
    materializeFillerLists: vi
      .fn()
      .mockImplementation((ids: Set<string>) =>
        Promise.resolve(
          Object.fromEntries(
            [...ids].map((id) => [id, extras.byFillerListId?.[id] ?? []]),
          ),
        ),
      ),
    materializeSmartCollections: vi.fn().mockResolvedValue({}),
  } as unknown as SlotSchedulerHelper;
}

function makeGenerator(helper: SlotSchedulerHelper): InfiniteScheduleGenerator {
  return new InfiniteScheduleGenerator(
    mockLogger,
    null as unknown as InfiniteScheduleDB,
    helper,
  );
}

// ── Result helpers ────────────────────────────────────────────────────────────

const contentItems = (r: GenerationResult) =>
  r.items.filter((i) => i.itemType === 'content');

const flexItems = (r: GenerationResult) =>
  r.items.filter((i) => i.itemType === 'flex');

const fillerItems = (r: GenerationResult) =>
  r.items.filter((i) => i.itemType === 'filler');

/** Assert no time gaps or overlaps in the full item list. */
function assertContinuous(items: GenerationResult['items']) {
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1]!;
    const curr = items[i]!;
    expect(curr.startTimeMs, `Gap/overlap at index ${i}`).toBe(
      prev.startTimeMs + prev.durationMs,
    );
  }
}

/** Assert the first item starts at fromTimeMs and the last ends at toTimeMs. */
function assertWindowCovered(r: GenerationResult) {
  expect(r.items[0]?.startTimeMs).toBe(r.fromTimeMs);
  const last = r.items.at(-1)!;
  expect(last.startTimeMs + last.durationMs).toBe(r.toTimeMs);
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('InfiniteScheduleGenerator', () => {
  beforeEach(() => {
    _slotIndex = 0;
    vi.clearAllMocks();
  });

  // ── 1. Single-slot — fill mode: fill ────────────────────────────────────────
  describe('fill mode: fill', () => {
    it('cycles programs in order through the window', async () => {
      const showId = 'show-a';
      const programs = makePrograms(3, { prefix: 'ep' });
      const slot = makeCustomShowSlot(showId);
      const schedule = makeSchedule([slot]);
      const gen = makeGenerator(makeHelper({ [showId]: programs }));

      // 4 hours → 4 programs: ep-0, ep-1, ep-2, then ep-0 again
      const result = await gen.preview(schedule, 0, 4 * HOUR_MS);

      expect(contentItems(result).map((i) => i.programUuid)).toEqual([
        'ep-0',
        'ep-1',
        'ep-2',
        'ep-0',
      ]);
    });

    it('covers the full window with no time gaps', async () => {
      const showId = 'show-a';
      const slot = makeCustomShowSlot(showId);
      const schedule = makeSchedule([slot]);
      const gen = makeGenerator(
        makeHelper({ [showId]: makePrograms(2) }),
      );

      const result = await gen.preview(schedule, 0, 3 * HOUR_MS);

      assertContinuous(result.items);
      assertWindowCovered(result);
    });

    it('outputs only flex when slot has no programs', async () => {
      const showId = 'empty';
      const slot = makeCustomShowSlot(showId);
      const schedule = makeSchedule([slot]);
      const gen = makeGenerator(makeHelper({ [showId]: [] }));

      const result = await gen.preview(schedule, 0, HOUR_MS);

      expect(contentItems(result)).toHaveLength(0);
      expect(flexItems(result).length).toBeGreaterThan(0);
      assertWindowCovered(result);
    });
  });

  // ── 2. Fill mode: count ──────────────────────────────────────────────────────
  describe('fill mode: count', () => {
    it('emits exactly N programs per rotation, then cycles', async () => {
      const showId = 'show-a';
      const programs = makePrograms(5, { prefix: 'ep' });
      // count = 2: emit 2 programs, then rotate (flex until window end or next slot)
      const slot = makeCustomShowSlot(showId, {
        fillMode: 'count',
        fillValue: 2,
      });
      const schedule = makeSchedule([slot]);
      const gen = makeGenerator(makeHelper({ [showId]: programs }));

      // 6 hours; count=2 → 2 programs then rotation; each program 1 h
      // Rotation 1: ep-0, ep-1 | Rotation 2: ep-2, ep-3 | Rotation 3: ep-4, ep-0
      const result = await gen.preview(schedule, 0, 6 * HOUR_MS);

      expect(contentItems(result).map((i) => i.programUuid)).toEqual([
        'ep-0',
        'ep-1',
        'ep-2',
        'ep-3',
        'ep-4',
        'ep-0',
      ]);
      assertContinuous(result.items);
      assertWindowCovered(result);
    });
  });

  // ── 3. Fill mode: duration ───────────────────────────────────────────────────
  describe('fill mode: duration', () => {
    it('emits programs until accumulated duration crosses fillValue', async () => {
      const showId = 'show-a';
      const thirtyMin = 30 * 60 * 1000;
      const ninetyMin = 3 * thirtyMin; // fillValue: 90 min
      const programs = makePrograms(5, { duration: thirtyMin, prefix: 'ep' });
      const slot = makeCustomShowSlot(showId, {
        fillMode: 'duration',
        fillValue: ninetyMin,
      });
      const schedule = makeSchedule([slot]);
      const gen = makeGenerator(makeHelper({ [showId]: programs }));

      // 3 hours → 2 full rotations of 3×30 min each
      const result = await gen.preview(schedule, 0, 3 * HOUR_MS);

      // Rotation 1: ep-0,ep-1,ep-2 | Rotation 2: ep-3,ep-4,ep-0
      expect(contentItems(result).map((i) => i.programUuid)).toEqual([
        'ep-0',
        'ep-1',
        'ep-2',
        'ep-3',
        'ep-4',
        'ep-0',
      ]);
      assertContinuous(result.items);
      assertWindowCovered(result);
    });
  });

  // ── 4. padToMultiple ─────────────────────────────────────────────────────────
  describe('padToMultiple', () => {
    it('inserts flex padding to align each program to the next multiple', async () => {
      const showId = 'show-a';
      const fortyFiveMin = 45 * 60 * 1000;
      const thirtyMin = 30 * 60 * 1000;
      // 45-min programs padded to 60-min multiples → 15-min pad after each
      const programs = makePrograms(2, { duration: fortyFiveMin });
      const slot = makeCustomShowSlot(showId);
      const schedule = makeSchedule([slot], { padToMultiple: thirtyMin });
      const gen = makeGenerator(makeHelper({ [showId]: programs }));

      const result = await gen.preview(schedule, 0, 2 * HOUR_MS);

      const content = contentItems(result);
      expect(content).toHaveLength(2);
      content.forEach((item) =>
        expect(item.durationMs).toBe(fortyFiveMin),
      );

      // Flex gap between program 0 and program 1 should be exactly 15 min
      const gapItems = result.items.filter(
        (i) =>
          i.startTimeMs >= content[0]!.startTimeMs + content[0]!.durationMs &&
          i.startTimeMs < content[1]!.startTimeMs,
      );
      const gapMs = gapItems.reduce((s, i) => s + i.durationMs, 0);
      expect(gapMs).toBe(15 * 60 * 1000);

      assertContinuous(result.items);
      assertWindowCovered(result);
    });

    it('self-corrects alignment when generation starts at a non-multiple time', async () => {
      const showId = 'show-a';
      const fortyFiveMin = 45 * 60 * 1000;
      const thirtyMin = 30 * 60 * 1000;
      // Start at 10 min past a boundary — NOT a multiple of 30
      const startOffset = 10 * 60 * 1000;
      const programs = makePrograms(3, { duration: fortyFiveMin });
      const slot = makeCustomShowSlot(showId);
      const schedule = makeSchedule([slot], { padToMultiple: thirtyMin });
      const gen = makeGenerator(makeHelper({ [showId]: programs }));

      const result = await gen.preview(
        schedule,
        startOffset,
        startOffset + 3 * HOUR_MS,
      );

      const content = contentItems(result);
      expect(content.length).toBeGreaterThanOrEqual(2);

      // Every program (including the first) must start on a 30-min multiple
      for (const item of content) {
        expect(item.startTimeMs % thirtyMin).toBe(0);
      }
      assertContinuous(result.items);
    });
  });

  // ── 5. Slot padding (padMs) ──────────────────────────────────────────────────
  describe('slot padding: padMs', () => {
    it('inserts fixed-duration flex after each program', async () => {
      const showId = 'show-a';
      const thirtyMin = 30 * 60 * 1000;
      const programs = makePrograms(2, { duration: thirtyMin, prefix: 'ep' });
      const slot = makeCustomShowSlot(showId, { padMs: thirtyMin });
      const schedule = makeSchedule([slot]);
      const gen = makeGenerator(makeHelper({ [showId]: programs }));

      // 2-hour window: ep-0 (30min) + flex (30min) + ep-1 (30min) + flex (30min)
      const result = await gen.preview(schedule, 0, 2 * HOUR_MS);

      const items = result.items;
      expect(items.length).toBe(4);
      expect(items[0]?.itemType).toBe('content');
      expect(items[1]?.itemType).toBe('flex');
      expect(items[2]?.itemType).toBe('content');
      expect(items[3]?.itemType).toBe('flex');
      // Last item is flex
      expect(items.at(-1)?.itemType).toBe('flex');
      assertContinuous(result.items);
      assertWindowCovered(result);
    });

    it('slot-level padToMultiple overrides schedule-level padToMultiple', async () => {
      const showId = 'show-a';
      const twentyMin = 20 * 60 * 1000;
      const thirtyMin = 30 * 60 * 1000;
      const sixtyMin = HOUR_MS;
      const programs = makePrograms(3, { duration: twentyMin, prefix: 'ep' });
      // Slot overrides to 30-min multiples; schedule sets 60-min multiples
      const slot = makeCustomShowSlot(showId, { padToMultiple: thirtyMin });
      const schedule = makeSchedule([slot], { padToMultiple: sixtyMin });
      const gen = makeGenerator(makeHelper({ [showId]: programs }));

      // 90-min window: each 20-min program gets 10-min flex (30-min multiple),
      // NOT 40-min flex (which would result from 60-min multiple)
      const result = await gen.preview(schedule, 0, 90 * 60 * 1000);

      const flex = flexItems(result);
      expect(flex.length).toBeGreaterThan(0);
      flex.forEach((f) => expect(f.durationMs).toBe(10 * 60 * 1000));
      assertContinuous(result.items);
      assertWindowCovered(result);
    });
  });

  // ── 6. Shuffle playback order ────────────────────────────────────────────────
  describe('shuffle playback order', () => {
    it('anchor fires at the correct time while floating slots fill the gaps', async () => {
      const floatId = 'float';
      const anchorId = 'anchor';
      // Use 1-hour programs so timing is easy to reason about.
      const floatSlot = makeCustomShowSlot(floatId);
      const anchorSlot = makeCustomShowSlot(anchorId, {
        anchorTime: 6 * HOUR_MS, // 6 AM
      });
      const schedule = makeSchedule([floatSlot, anchorSlot], {
        slotPlaybackOrder: 'shuffle',
      });
      const gen = makeGenerator(
        makeHelper({
          [floatId]: makePrograms(20, { prefix: 'f' }),
          [anchorId]: makePrograms(5, { prefix: 'a' }),
        }),
      );

      const result = await gen.preview(schedule, 0, DAY_MS);

      // The anchor must fire exactly once and start at exactly 6 AM.
      const anchorContent = result.items.filter(
        (i) => i.slotUuid === anchorSlot.uuid && i.itemType === 'content',
      );
      expect(anchorContent).toHaveLength(1);
      expect(anchorContent[0]!.startTimeMs).toBe(6 * HOUR_MS);

      // Floating content must exist and must not overlap the anchor.
      const floatContent = result.items.filter(
        (i) => i.slotUuid === floatSlot.uuid && i.itemType === 'content',
      );
      expect(floatContent.length).toBeGreaterThan(0);

      assertContinuous(result.items);
      assertWindowCovered(result);
    });

    it('anchor fires on each matching day in a multi-day shuffle window', async () => {
      const floatId = 'float';
      const anchorId = 'anchor';
      const floatSlot = makeCustomShowSlot(floatId);
      const anchorSlot = makeCustomShowSlot(anchorId, {
        anchorTime: 12 * HOUR_MS, // noon
      });
      const schedule = makeSchedule([floatSlot, anchorSlot], {
        slotPlaybackOrder: 'shuffle',
      });
      const gen = makeGenerator(
        makeHelper({
          [floatId]: makePrograms(100, { prefix: 'f' }),
          [anchorId]: makePrograms(10, { prefix: 'a' }),
        }),
      );

      const result = await gen.preview(schedule, 0, 3 * DAY_MS);

      const anchorContent = result.items.filter(
        (i) => i.slotUuid === anchorSlot.uuid && i.itemType === 'content',
      );
      expect(anchorContent).toHaveLength(3);
      expect(anchorContent.map((i) => i.startTimeMs)).toEqual(
        [0, 1, 2].map((d) => d * DAY_MS + 12 * HOUR_MS),
      );

      assertContinuous(result.items);
      assertWindowCovered(result);
    });

    it('anchor-only shuffle schedule (no floating slots) emits anchor programs with flex gaps', async () => {
      const anchorId = 'anchor';
      const anchorSlot = makeCustomShowSlot(anchorId, {
        anchorTime: 18 * HOUR_MS, // 6 PM
        fillMode: 'count',
        fillValue: 2,
      });
      const schedule = makeSchedule([anchorSlot], {
        slotPlaybackOrder: 'shuffle',
      });
      const gen = makeGenerator(
        makeHelper({ [anchorId]: makePrograms(5, { prefix: 'a' }) }),
      );

      const result = await gen.preview(schedule, 0, DAY_MS);

      const anchorContent = result.items.filter(
        (i) => i.slotUuid === anchorSlot.uuid && i.itemType === 'content',
      );
      // count=2 → 2 programs starting at 18:00
      expect(anchorContent).toHaveLength(2);
      expect(anchorContent[0]!.startTimeMs).toBe(18 * HOUR_MS);
      // The rest of the 24-hour window must be flex.
      const nonAnchor = result.items.filter(
        (i) => i.slotUuid !== anchorSlot.uuid,
      );
      nonAnchor.forEach((i) => expect(i.itemType).toBe('flex'));

      assertContinuous(result.items);
      assertWindowCovered(result);
    });
  });

  // ── 7. Multi-slot ordered rotation ──────────────────────────────────────────
  describe('multi-slot ordered rotation', () => {
    it('two floating slots alternate in order', async () => {
      const idA = 'show-a';
      const idB = 'show-b';
      const progsA = makePrograms(3, { prefix: 'a' });
      const progsB = makePrograms(3, { prefix: 'b' });
      const slotA = makeCustomShowSlot(idA, {
        fillMode: 'count',
        fillValue: 1,
      });
      const slotB = makeCustomShowSlot(idB, {
        fillMode: 'count',
        fillValue: 1,
      });
      const schedule = makeSchedule([slotA, slotB]);
      const gen = makeGenerator(
        makeHelper({ [idA]: progsA, [idB]: progsB }),
      );

      const result = await gen.preview(schedule, 0, 4 * HOUR_MS);

      expect(contentItems(result).map((i) => i.programUuid)).toEqual([
        'a-0',
        'b-0',
        'a-1',
        'b-1',
      ]);
      assertContinuous(result.items);
    });

    it('three floating slots rotate in index order', async () => {
      const ids = ['s1', 's2', 's3'];
      const progs = Object.fromEntries(
        ids.map((id) => [id, makePrograms(2, { prefix: id })]),
      );
      const slots = ids.map((id) =>
        makeCustomShowSlot(id, { fillMode: 'count', fillValue: 1 }),
      );
      const schedule = makeSchedule(slots);
      const gen = makeGenerator(makeHelper(progs));

      const result = await gen.preview(schedule, 0, 3 * HOUR_MS);

      expect(contentItems(result).map((i) => i.programUuid)).toEqual([
        's1-0',
        's2-0',
        's3-0',
      ]);
    });
  });

  // ── 7. Anchored slots ────────────────────────────────────────────────────────
  describe('anchored slots', () => {
    it('anchor fires at the correct UTC time with zero timezone offset', async () => {
      const floatId = 'float';
      const anchorId = 'anchor';
      const floatSlot = makeCustomShowSlot(floatId);
      // Anchor at 18:00 UTC (timeZoneOffset = 0)
      const anchorSlot = makeCustomShowSlot(anchorId, {
        anchorTime: 18 * HOUR_MS,
      });
      const schedule = makeSchedule([floatSlot, anchorSlot]);
      const gen = makeGenerator(
        makeHelper({
          [floatId]: makePrograms(20, { prefix: 'f' }),
          [anchorId]: makePrograms(3, { prefix: 'a' }),
        }),
      );

      const result = await gen.preview(schedule, 0, DAY_MS);

      const anchorContent = result.items.filter(
        (i) => i.slotUuid === anchorSlot.uuid && i.itemType === 'content',
      );
      expect(anchorContent.length).toBeGreaterThan(0);
      expect(anchorContent[0]!.startTimeMs).toBe(18 * HOUR_MS);
    });

    it('anchor fires once per matching day in a multi-day window', async () => {
      const floatId = 'float';
      const anchorId = 'anchor';
      const floatSlot = makeCustomShowSlot(floatId);
      const anchorSlot = makeCustomShowSlot(anchorId, {
        anchorTime: 12 * HOUR_MS, // noon UTC
      });
      const schedule = makeSchedule([floatSlot, anchorSlot]);
      const gen = makeGenerator(
        makeHelper({
          [floatId]: makePrograms(100, { prefix: 'f' }),
          [anchorId]: makePrograms(10, { prefix: 'a' }),
        }),
      );

      // 3 days
      const result = await gen.preview(schedule, 0, 3 * DAY_MS);

      const anchorContent = result.items.filter(
        (i) => i.slotUuid === anchorSlot.uuid && i.itemType === 'content',
      );
      // Anchor fires at noon each of the 3 days
      expect(anchorContent).toHaveLength(3);
      expect(anchorContent.map((i) => i.startTimeMs)).toEqual([
        1 * DAY_MS + 12 * HOUR_MS,
        0 * DAY_MS + 12 * HOUR_MS,
        2 * DAY_MS + 12 * HOUR_MS,
      ].sort((a, b) => a - b));
    });

    it('anchorDays filter: anchor fires only on specified UTC days', async () => {
      const floatId = 'float';
      const anchorId = 'anchor';
      const floatSlot = makeCustomShowSlot(floatId);
      // Epoch (0) = Thursday Jan 1 1970. Day 0 (Sun) = Jan 4; day 1 (Mon) = Jan 5.
      // Anchor at noon on Mondays (1) and Wednesdays (3).
      const anchorSlot = makeCustomShowSlot(anchorId, {
        anchorTime: 12 * HOUR_MS,
        anchorDays: [1, 3], // Monday, Wednesday
      });
      const schedule = makeSchedule([floatSlot, anchorSlot]);
      const gen = makeGenerator(
        makeHelper({
          [floatId]: makePrograms(100, { prefix: 'f' }),
          [anchorId]: makePrograms(20, { prefix: 'a' }),
        }),
      );

      // Jan 1–7 1970 UTC: Thu, Fri, Sat, Sun, Mon, Tue, Wed
      const result = await gen.preview(schedule, 0, 7 * DAY_MS);

      const anchorContent = result.items.filter(
        (i) => i.slotUuid === anchorSlot.uuid && i.itemType === 'content',
      );
      // Mon Jan 5 and Wed Jan 7 → exactly 2 firings
      expect(anchorContent).toHaveLength(2);
      anchorContent.forEach((item) => {
        expect([1, 3]).toContain(new Date(item.startTimeMs).getUTCDay());
      });
    });

    it('anchored slot interrupts an in-progress floating slot at the correct time', async () => {
      const floatId = 'float';
      const anchorId = 'anchor';
      // 3-hour programs so the anchor will interrupt mid-program
      const floatSlot = makeCustomShowSlot(floatId);
      const anchorSlot = makeCustomShowSlot(anchorId, {
        anchorTime: 5 * HOUR_MS, // 5 AM
      });
      const schedule = makeSchedule([floatSlot, anchorSlot]);
      const gen = makeGenerator(
        makeHelper({
          [floatId]: makePrograms(10, {
            duration: 3 * HOUR_MS,
            prefix: 'f',
          }),
          [anchorId]: makePrograms(5, { prefix: 'a' }),
        }),
      );

      const result = await gen.preview(schedule, 0, DAY_MS);

      // There should be an anchor content item that starts at or near 5 AM
      const anchorContent = result.items.filter(
        (i) => i.slotUuid === anchorSlot.uuid && i.itemType === 'content',
      );
      expect(anchorContent.length).toBeGreaterThan(0);
      // The anchor starts at exactly the anchor time (flex fills the gap)
      expect(anchorContent[0]!.startTimeMs).toBe(5 * HOUR_MS);

      assertContinuous(result.items);
    });
  });

  // ── 8. Timezone: non-UTC offset ──────────────────────────────────────────────
  describe('timezone: non-UTC offset', () => {
    it('anchor at 9 PM local (EST, UTC−5) fires at 2 AM UTC next day', async () => {
      // timeZoneOffset = 300 means UTC − local = 300 min → local is UTC−5 (EST)
      // 9 PM local = 21:00 EST = next-day 02:00 UTC
      const floatId = 'float';
      const anchorId = 'anchor';
      const floatSlot = makeCustomShowSlot(floatId);
      const anchorSlot = makeCustomShowSlot(anchorId, {
        anchorTime: 21 * HOUR_MS, // 9 PM local
      });
      const schedule = makeSchedule([floatSlot, anchorSlot], {
        timeZoneOffset: 300, // EST
      });
      const gen = makeGenerator(
        makeHelper({
          [floatId]: makePrograms(50, { prefix: 'f' }),
          [anchorId]: makePrograms(5, { prefix: 'a' }),
        }),
      );

      // UTC window: Jan 1 00:00 – Jan 2 00:00
      const result = await gen.preview(schedule, 0, DAY_MS);

      const anchorContent = result.items.filter(
        (i) => i.slotUuid === anchorSlot.uuid && i.itemType === 'content',
      );
      // Jan 1 9 PM EST = Jan 2 02:00 UTC (outside our 1-day window)
      // Dec 31 9 PM EST = Jan 1 02:00 UTC (inside)
      expect(anchorContent).toHaveLength(1);
      expect(anchorContent[0]!.startTimeMs).toBe(2 * HOUR_MS);
    });

    it('anchorDays filter uses local day (not UTC day)', async () => {
      // EST (UTC−5, timeZoneOffset=300): local Sunday starts at UTC Sunday 05:00.
      // Anchor at 8 PM local Sunday = UTC Monday 01:00.
      // UTC window Jan 5–12 1970 (Mon–Mon). Jan 4 1970 is Sunday UTC;
      // local Sunday Jan 4 = UTC Jan 4 05:00 → Jan 5 04:59.
      // 8 PM local Sunday Jan 4 = UTC Monday Jan 5 01:00 → inside the window.
      // Next local Sunday is Jan 11 → 8 PM = UTC Monday Jan 12 01:00 → outside.
      const floatId = 'float';
      const anchorId = 'anchor';
      const floatSlot = makeCustomShowSlot(floatId);
      const anchorSlot = makeCustomShowSlot(anchorId, {
        anchorTime: 20 * HOUR_MS, // 8 PM local
        anchorDays: [0], // Sunday in local time
      });
      const schedule = makeSchedule([floatSlot, anchorSlot], {
        timeZoneOffset: 300,
      });
      const gen = makeGenerator(
        makeHelper({
          [floatId]: makePrograms(100, { prefix: 'f' }),
          [anchorId]: makePrograms(5, { prefix: 'a' }),
        }),
      );

      const from = 4 * DAY_MS; // Jan 5 1970 00:00 UTC (Monday)
      const to = 11 * DAY_MS; // Jan 12 1970 00:00 UTC (Monday)
      const result = await gen.preview(schedule, from, to);

      const anchorContent = result.items.filter(
        (i) => i.slotUuid === anchorSlot.uuid && i.itemType === 'content',
      );
      expect(anchorContent).toHaveLength(1);
      // 8 PM local Sunday Jan 4 = UTC Jan 5 01:00 = 4*DAY_MS + HOUR_MS
      expect(anchorContent[0]!.startTimeMs).toBe(4 * DAY_MS + HOUR_MS);
    });
  });

  // ── 9. DST handling ──────────────────────────────────────────────────────────
  describe('DST handling', () => {
    // US Eastern timezone DST transitions in 2025:
    //   Spring forward: March 9, 2025 at 2:00 AM EST → 3:00 AM EDT (23-hour day)
    //   Fall back:      November 2, 2025 at 2:00 AM EDT → 1:00 AM EST (25-hour day)
    //
    // Set process.env.TZ so that plain dayjs(epochMs).utcOffset() reflects
    // Eastern Time DST transitions — the same technique used in TimeSlotService.
    const TZ = 'America/New_York';
    let originalTZ: string | undefined;

    beforeAll(() => {
      originalTZ = process.env['TZ'];
      process.env['TZ'] = TZ;
    });

    afterAll(() => {
      if (originalTZ !== undefined) {
        process.env['TZ'] = originalTZ;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete process.env['TZ'];
      }
    });

    /** Convert a local Eastern-time string to a UTC epoch ms value. */
    const etMs = (dateStr: string) => +dayjs.tz(dateStr, TZ);

    it('spring forward: anchor at 9 PM local fires at correct UTC time on both sides of the transition', async () => {
      const floatId = 'float';
      const anchorId = 'anchor';
      const floatSlot = makeCustomShowSlot(floatId);
      const anchorSlot = makeCustomShowSlot(anchorId, {
        anchorTime: 21 * HOUR_MS, // 9 PM local
      });
      // Schedule stored with EST standard offset (300 = UTC−5)
      const schedule = makeSchedule([floatSlot, anchorSlot], {
        timeZoneOffset: 300,
      });
      const gen = makeGenerator(
        makeHelper({
          [floatId]: makePrograms(100, { prefix: 'f' }),
          [anchorId]: makePrograms(10, { prefix: 'a' }),
        }),
      );

      // Window: March 9 midnight ET → March 11 midnight ET
      const from = etMs('2025-03-09T00:00:00');
      const to = etMs('2025-03-11T00:00:00');
      const result = await gen.preview(schedule, from, to);

      const anchorContent = result.items.filter(
        (i) => i.slotUuid === anchorSlot.uuid && i.itemType === 'content',
      );

      // March 9 is the spring-forward day (23-hour day).
      // 9 PM EDT on March 9  = UTC March 10 01:00 (UTC−4 during EDT)
      // 9 PM EDT on March 10 = UTC March 11 01:00 — outside the 'to' bound
      // So we expect exactly ONE firing in this 2-day window.
      expect(anchorContent).toHaveLength(2);
      expect(anchorContent[0]!.startTimeMs).toBe(etMs('2025-03-09T21:00:00'));
      expect(anchorContent[1]!.startTimeMs).toBe(etMs('2025-03-10T21:00:00'));
    });

    it('fall back: anchor fires exactly once per local day (no duplication)', async () => {
      const floatId = 'float';
      const anchorId = 'anchor';
      const floatSlot = makeCustomShowSlot(floatId);
      const anchorSlot = makeCustomShowSlot(anchorId, {
        anchorTime: 21 * HOUR_MS, // 9 PM local
      });
      // Schedule stored with EDT offset (240 = UTC−4, summer/DST time)
      const schedule = makeSchedule([floatSlot, anchorSlot], {
        timeZoneOffset: 240,
      });
      const gen = makeGenerator(
        makeHelper({
          [floatId]: makePrograms(100, { prefix: 'f' }),
          [anchorId]: makePrograms(10, { prefix: 'a' }),
        }),
      );

      // Window: November 1 midnight ET → November 3 midnight ET
      const from = etMs('2025-11-01T00:00:00');
      const to = etMs('2025-11-03T00:00:00');
      const result = await gen.preview(schedule, from, to);

      const anchorContent = result.items.filter(
        (i) => i.slotUuid === anchorSlot.uuid && i.itemType === 'content',
      );

      // November 2 is the fall-back day (25-hour day).
      // 9 PM on Nov 1 (EDT, UTC−4) = UTC Nov 2 01:00
      // 9 PM on Nov 2 (EST, UTC−5) = UTC Nov 3 02:00 — outside 'to'
      // The anchor should fire exactly twice (once per local day), not three times.
      expect(anchorContent).toHaveLength(2);

      // Each firing must be at a distinct UTC time (no duplicate)
      const startTimes = new Set(anchorContent.map((i) => i.startTimeMs));
      expect(startTimes.size).toBe(2);

      expect(anchorContent[0]!.startTimeMs).toBe(etMs('2025-11-01T21:00:00'));
      expect(anchorContent[1]!.startTimeMs).toBe(etMs('2025-11-02T21:00:00'));
    });
  });

  // ── 10. Filler injection ─────────────────────────────────────────────────────
  describe('filler injection', () => {
    const fillerListId = 'filler-list-1';
    const fillerProgs = () =>
      makePrograms(5, { duration: 10 * 60 * 1000, prefix: 'filler' }); // 10-min fillers

    it('relaxed pre filler: injected within the flex budget', async () => {
      const showId = 'show-a';
      // 50-min programs with 1-hour padToMultiple → 10-min flex budget after each
      const contentProgs = makePrograms(3, {
        duration: 50 * 60 * 1000,
        prefix: 'content',
      });
      const slot = makeCustomShowSlot(showId, {
        fillerConfig: {
          fillers: [
            {
              types: ['pre'],
              fillerListId,
              fillerOrder: 'uniform',
              mode: 'relaxed',
            },
          ],
        },
        padToMultiple: HOUR_MS,
        fillMode: 'count',
        fillValue: 2,
      });
      const schedule = makeSchedule([slot]);
      const gen = makeGenerator(
        makeHelper(
          { [showId]: contentProgs },
          { byFillerListId: { [fillerListId]: fillerProgs() } },
        ),
      );

      const result = await gen.preview(schedule, 0, 2 * HOUR_MS);

      const fillers = fillerItems(result);
      expect(fillers.length).toBeGreaterThan(0);
      fillers.forEach((f) => expect(f.fillerListId).toBe(fillerListId));
      assertContinuous(result.items);
    });

    it('relaxed pre filler: skipped when no filler program fits within budget', async () => {
      const showId = 'show-a';
      // Programs exactly fill the window; no flex budget for filler
      const contentProgs = makePrograms(2, {
        duration: HOUR_MS, // exactly 1 hour; no room
        prefix: 'content',
      });
      const slot = makeCustomShowSlot(showId, {
        fillerConfig: {
          fillers: [
            {
              types: ['pre'],
              fillerListId,
              fillerOrder: 'uniform',
              mode: 'relaxed',
            },
          ],
        },
        fillMode: 'count',
        fillValue: 2,
      });
      const schedule = makeSchedule([slot]);
      const gen = makeGenerator(
        makeHelper(
          { [showId]: contentProgs },
          { byFillerListId: { [fillerListId]: fillerProgs() } },
        ),
      );

      const result = await gen.preview(schedule, 0, 2 * HOUR_MS);

      // No room → no filler items
      expect(fillerItems(result)).toHaveLength(0);
      assertContinuous(result.items);
    });

    it('strict pre filler count=2: two filler items appear before each content program', async () => {
      const showId = 'show-a';
      const contentProgs = makePrograms(2, {
        duration: 30 * 60 * 1000,
        prefix: 'content',
      });
      const slot = makeCustomShowSlot(showId, {
        fillerConfig: {
          fillers: [
            {
              types: ['pre'],
              fillerListId,
              fillerOrder: 'uniform',
              mode: 'strict',
              count: 2,
            },
          ],
        },
        fillMode: 'count',
        fillValue: 1,
      });
      const schedule = makeSchedule([slot]);
      const gen = makeGenerator(
        makeHelper(
          { [showId]: contentProgs },
          { byFillerListId: { [fillerListId]: fillerProgs() } },
        ),
      );

      const result = await gen.preview(schedule, 0, 2 * HOUR_MS);

      // For every content item, the two immediately preceding items must be filler
      const items = result.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i]?.itemType === 'content') {
          expect(items[i - 1]?.itemType, `pre-filler -1 at ${i}`).toBe(
            'filler',
          );
          expect(items[i - 2]?.itemType, `pre-filler -2 at ${i}`).toBe(
            'filler',
          );
        }
      }
      assertContinuous(result.items);
    });

    it('strict head filler: fires once before the first program in each count run', async () => {
      const showId = 'show-a';
      const contentProgs = makePrograms(4, {
        duration: 20 * 60 * 1000,
        prefix: 'content',
      });
      // count=2 → each run has 2 programs; head fires once per run
      const slot = makeCustomShowSlot(showId, {
        fillerConfig: {
          fillers: [
            {
              types: ['head'],
              fillerListId,
              fillerOrder: 'uniform',
              mode: 'strict',
              count: 1,
            },
          ],
        },
        fillMode: 'count',
        fillValue: 2,
      });
      const schedule = makeSchedule([slot]);
      const gen = makeGenerator(
        makeHelper(
          { [showId]: contentProgs },
          { byFillerListId: { [fillerListId]: fillerProgs() } },
        ),
      );

      // 2 runs fit in this window; each run: [head-filler, content, content]
      const result = await gen.preview(schedule, 0, 2 * HOUR_MS);

      // Locate start-of-run indices (first content in each group of 2)
      const items = result.items;
      let contentCount = 0;
      for (let i = 0; i < items.length; i++) {
        if (items[i]?.itemType === 'content') {
          if (contentCount % 2 === 0) {
            // First in run: immediately preceding item must be filler (head)
            const preceding = items
              .slice(0, i)
              .filter((x) => x.itemType !== 'flex');
            expect(preceding.at(-1)?.itemType).toBe('filler');
          }
          contentCount++;
        }
      }
    });
  });

  // ── 11. Shuffle mode — new content discovery ─────────────────────────────────
  describe('shuffle mode — new content discovery', () => {
    /**
     * Helper that promotes a SlotStateUpdate back into the
     * InfiniteScheduleSlotState shape expected by the slot.
     */
    function restoreSlotState(
      slot: InfiniteScheduleSlot,
      saved: SlotStateUpdate,
    ): InfiniteScheduleSlotState {
      return {
        uuid: v4(),
        channelUuid: 'ch',
        slotUuid: slot.uuid,
        rngSeed: saved.rngSeed,
        rngUseCount: saved.rngUseCount,
        iteratorPosition: saved.iteratorPosition,
        shuffleOrder: saved.shuffleOrder ?? null,
        fillModeCount: saved.fillModeCount,
        fillModeDurationMs: saved.fillModeDurationMs,
        fillerState: saved.fillerState,
        lastScheduledAt: null,
        createdAt: null,
        updatedAt: null,
      };
    }

    it('list grows: new program appears in the current pass and existing shuffle order is preserved', async () => {
      const showId = 'show-a';
      const programs = makePrograms(3, { prefix: 'a' });
      const slot = makeCustomShowSlot(showId, {
        slotConfig: { order: 'shuffle', direction: 'asc' },
      });

      // Run 1: consume a full 3-program shuffle pass → iterator wraps to position 0.
      const run1 = await makeGenerator(makeHelper({ [showId]: programs })).preview(
        makeSchedule([slot]),
        0,
        3 * HOUR_MS,
      );

      const savedState = run1.slotStates.get(slot.uuid)!;
      const slotState = restoreSlotState(slot, savedState);

      // Add a 4th program (list grows 3 → 4).
      const a3 = createFakeProgramOrm({
        uuid: 'a-3',
        type: 'movie',
        duration: HOUR_MS,
      });
      const expandedPrograms = [...programs, a3];

      // Run 2: 4-hour window with restored state → enough time to schedule all 4.
      const run2 = await makeGenerator(
        makeHelper({ [showId]: expandedPrograms }),
      ).preview(
        makeSchedule([{ ...slot, state: slotState }]),
        3 * HOUR_MS,
        7 * HOUR_MS,
      );

      const run1UUIDs = contentItems(run1).map((i) => i.programUuid);
      const run2UUIDs = contentItems(run2).map((i) => i.programUuid);

      // The new program must appear in the current pass (not deferred to the next full cycle).
      expect(run2UUIDs).toContain('a-3');

      // The existing programs must appear in the SAME relative order as run 1
      // (reconcile preserves the stored shuffle order rather than regenerating it).
      const run2ExistingOrder = run2UUIDs.filter((id) => id !== 'a-3');
      expect(run2ExistingOrder.slice(0, 3)).toEqual(run1UUIDs);
    });

    it('same-size mutation: replaced program is not silently dropped', async () => {
      const showId = 'show-a';
      // Programs: a-0, a-1, a-2
      const programs = makePrograms(3, { prefix: 'a' });
      const slot = makeCustomShowSlot(showId, {
        slotConfig: { order: 'shuffle', direction: 'asc' },
      });

      // Run 1: full 3-program pass.
      const run1 = await makeGenerator(makeHelper({ [showId]: programs })).preview(
        makeSchedule([slot]),
        0,
        3 * HOUR_MS,
      );

      const savedState = run1.slotStates.get(slot.uuid)!;
      const slotState = restoreSlotState(slot, savedState);

      // Replace a-0 with a-new — list length stays at 3.
      const aNew = createFakeProgramOrm({
        uuid: 'a-new',
        type: 'movie',
        duration: HOUR_MS,
      });
      const mutatedPrograms = programs
        .filter((p) => p.uuid !== 'a-0')
        .concat([aNew]);

      // Run 2 with restored state — in the old implementation the length check
      // would pass (3 === 3) and applyShuffleOrder would silently drop a-new.
      const run2 = await makeGenerator(
        makeHelper({ [showId]: mutatedPrograms }),
      ).preview(
        makeSchedule([{ ...slot, state: slotState }]),
        3 * HOUR_MS,
        6 * HOUR_MS,
      );

      const run2UUIDs = contentItems(run2).map((i) => i.programUuid);

      // The new program must appear — not silently dropped.
      expect(run2UUIDs).toContain('a-new');
      // The removed program must not appear.
      expect(run2UUIDs).not.toContain('a-0');
    });
  });

  // ── 12. State persistence across preview runs ────────────────────────────────
  describe('state persistence', () => {
    it('second run continues from the saved iterator position', async () => {
      const showId = 'show-a';
      // 6 distinct programs; run 1 uses 3, run 2 should pick up with the next 3
      const programs = makePrograms(6, { prefix: 'ep' });
      const slot = makeCustomShowSlot(showId);

      const buildSchedule = (slotState: InfiniteScheduleSlotState | null) =>
        makeSchedule([{ ...slot, state: slotState }]);

      const helper = makeHelper({ [showId]: programs });

      // Run 1: generate 3 hours (3 × 1-hour programs)
      const run1 = await makeGenerator(helper).preview(
        buildSchedule(null),
        0,
        3 * HOUR_MS,
      );

      const savedState = run1.slotStates.get(slot.uuid);
      expect(savedState).toBeDefined();

      // Reconstruct slot state from the saved SlotStateUpdate
      const restoredSlotState: InfiniteScheduleSlotState = {
        uuid: v4(),
        channelUuid: 'test-channel',
        slotUuid: slot.uuid,
        rngSeed: savedState!.rngSeed,
        rngUseCount: savedState!.rngUseCount,
        iteratorPosition: savedState!.iteratorPosition,
        shuffleOrder: savedState!.shuffleOrder ?? null,
        fillModeCount: savedState!.fillModeCount,
        fillModeDurationMs: savedState!.fillModeDurationMs,
        fillerState: savedState!.fillerState,
        lastScheduledAt: null,
        createdAt: null,
        updatedAt: null,
      };

      // Run 2: generate the next 3 hours with restored state
      const run2 = await makeGenerator(helper).preview(
        buildSchedule(restoredSlotState),
        3 * HOUR_MS,
        6 * HOUR_MS,
      );

      const run1Uuids = contentItems(run1).map((i) => i.programUuid);
      const run2Uuids = contentItems(run2).map((i) => i.programUuid);

      // Run 1 consumed ep-0, ep-1, ep-2; run 2 continues with ep-3, ep-4, ep-5
      expect(run1Uuids).toEqual(['ep-0', 'ep-1', 'ep-2']);
      expect(run2Uuids).toEqual(['ep-3', 'ep-4', 'ep-5']);
    });
  });
});
