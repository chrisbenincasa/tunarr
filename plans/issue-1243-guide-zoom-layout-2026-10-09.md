# Issue #1243: guide layout breaks across zoom levels

> **Status (10/09/2026):** PR #2265 open against `main` (branch `fix/guide-zoom-layout`). Ships option 2, the now-pill and `reset` fixes, compact sub-24px blocks, and shorter/sparser header times. Verified on a six-channel fixture at 1440px and 1000px: grid width equals its box at all 8 zoom levels (was 2010–16991px in a 925px box). Next step is review.

## Reproduction

- Script drives `/web/guide`, steps zoom from 1h to 8h, and measures the grid. Run at 1600, 1100, and 800px viewports.
- Dev DB has one channel of long movies. The many-short-programs case was simulated by cloning one program block 80 times in the live DOM.

| Case | Result |
| --- | --- |
| 1600px and 1100px, all zoom levels | Grid fills its container. Block widths match program times. |
| 800px, 6h and up | Grid grows past its 403px container (510, 510, 611px). The guide scrolls sideways, 6h and 7h render the same width, and right-hand time labels are cut off. |
| 1600px, 80 short programs in one row | Grid grows from 1082px to 9756px. |
| Any width, 4h and up | The current-time pill is clipped at the left edge ("2:19 PM", ":19 PM"). |
| 1h | The trailing program renders as a 12–18px sliver with unreadable text. |

## Root cause

- The grid column in `web/src/components/guide/TvGuide.tsx:523-531` uses `width: fit-content; minWidth: 100%`.
- Header slots and program blocks size with percentages (`calc(100% * fraction)`) of that column.
- `fit-content` sizes the column from its children's intrinsic widths. Flex items default to `min-width: auto`, so each block and header slot refuses to shrink below its text or its padding and borders.
- So when the labels or blocks don't fit, the column widens. The percentages then resolve against the wider column, and the whole guide scales out of proportion to the viewport.
- More zoom means more header slots and more programs per row, so it triggers sooner at higher zoom and on narrow windows. That matches the reporter's "zoom 3–6 look identical."
- The `minWidth: 100%` added after #1197 stops the grid from getting *narrower* than the container, which fixed the "too thin" symptom. It does nothing for the *wider* case.

## Fix options

1. **CSS patch.** Set the column to `width: 100%`, and give header slots and blocks `min-width: 0`, `box-sizing: border-box`, `overflow: hidden`.
   - Tested in the live DOM. Grid holds at container width at 800px/8h and with 80 short blocks.
   - Leftover problem: each block still has a 12px floor (2px margin plus 10px horizontal border), so 80 short blocks need 960px and overflow the row. Time drift also builds up across many blocks.
2. **Position blocks by time (recommended).** Make each row `position: relative`, and place each block with `left = (start - guideStart) / duration` and `width = duration / guideDuration`, both in percent. Draw spacing with an inset inner box or `outline`, not margins and borders that take up width.
   - Blocks can't push the grid wider, and they can't drift from the header or the now-line.
   - Removes the trim and `totalProgramDuration` math in `renderProgram`, because clamping start and end to the guide window does the same job.
   - Hide text below a pixel threshold, and let the tooltip or dialog carry it.
3. **Now-pill clipping (separate, small).** The pill uses `marginLeft: -50%` inside an `overflowX: auto` box, so it gets cut off near the left edge. Clamp it with `transform: translateX(clamp(...))`, or render it outside the scroll container.

## Other bugs seen in `GuidePage.tsx`

- `reset` sets the stored duration and `start` but never updates `end`, so the guide stays at the old zoom until the next navigation.
- `zoomIn`/`zoomOut` call `setGuideDurationState` inside a `setEnd` updater. That is a side effect, and React may run it twice in strict mode.
