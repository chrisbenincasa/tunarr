# Mid-Roll Breaks

Mid-roll breaks insert commercial-style breaks _within_ programs, splitting a long movie or episode into segments separated by filler content. This simulates the experience of traditional TV commercial breaks.

Mid-roll breaks are configured per-slot in the [Slot Editor](random-slots.md) and [Time Slots](time-slots.md) editors. Any slot type that supports [filler](../library/filler.md) also supports mid-roll breaks.

## Prerequisites

To use mid-roll breaks, you need:

1. A [filler list](../library/filler.md) with content (commercials, bumpers, etc.)
2. The filler list assigned to a slot with the **Mid** filler type

When editing a slot in the Slot Editor or Time Slots editor, add a filler list and select "Mid" as one of its types. Once a "Mid" filler is assigned, the mid-roll configuration panel appears.

## Break Positioning

Mid-roll breaks support three positioning rules that control _where_ breaks are inserted within a program.

### Fixed Interval

Inserts breaks at regular time intervals throughout the program.

| Setting | Description |
|---------|-------------|
| **Interval** | Time between breaks (e.g., every 30 minutes) |

A 2-hour movie with a 30-minute interval gets breaks at 30m, 60m, and 90m.

### Percentage-Based

Inserts breaks at specific points expressed as percentages of the program's total duration.

| Setting | Description |
|---------|-------------|
| **Points** | One or more percentage values (1–99%) |

A 2-hour movie with points at 25%, 50%, and 75% gets breaks at 30m, 60m, and 90m.

### Initial Delay + Interval

Combines an initial delay before the first break with a regular interval for subsequent breaks.

| Setting | Description |
|---------|-------------|
| **Initial Delay** | Time before the first break |
| **Interval** | Time between subsequent breaks |

A 2-hour movie with a 15-minute initial delay and 30-minute interval gets breaks at 15m, 45m, 75m, and 105m.

## Break Duration

Break duration can be configured in two modes:

- **Fixed**: Every break has the same duration (e.g., 3 minutes).
- **Range**: Each break's duration is randomly chosen between a minimum and maximum value (e.g., 2–5 minutes). This makes breaks feel less mechanical.

## Limits and Filters

| Setting | Description | Default |
|---------|-------------|---------|
| **Max Breaks** | Maximum number of breaks per program. 0 = unlimited. | 0 |
| **Minimum Program Duration** | Programs shorter than this are skipped entirely. | 60 minutes |
| **Tail Buffer** | Minimum amount of content preserved at the end of the program before the credits. No breaks are inserted within this window. | 0 |
| **Program Types** | Restrict mid-roll to specific content types (Movies, Episodes, Music Tracks, Music Videos, Other Videos). Empty = all types. | All |

## Scheduling Strategy

The scheduling strategy controls _when_ filler content is selected for mid-roll breaks.

### Eager

Filler is selected at **schedule generation time**. The specific filler programs are embedded directly into the channel lineup.

- The TV guide shows the actual filler titles during breaks.
- Filler selection uses cooldown state from the time the schedule was generated.

### Lazy

Filler selection is deferred to **stream time** — the moment a viewer is actually watching the channel. During schedule generation, placeholder "Commercial Break" entries are created.

- The TV guide shows generic "Commercial Break" entries.
- Filler selection uses fresh cooldown state, reducing repeats.
- Filler is drawn from the slot's mid-roll filler lists.

!!! tip
    Use the **Lazy** strategy if you want the most variety in your filler content. Because filler is picked at playback time, the system has up-to-date knowledge of what has recently played and can avoid repeats more effectively.

## Example Configuration

To add 3-minute commercial breaks every 30 minutes to movies longer than 1 hour:

1. Open a slot in the Slot Editor or Time Slots editor.
2. Add a filler list and select the **Mid** type.
3. In the mid-roll configuration panel:
    - **Break Rule**: Fixed Interval, 30 minutes
    - **Break Duration**: Fixed, 3 minutes
    - **Minimum Program Duration**: 60 minutes
    - **Max Breaks**: 0 (unlimited)
    - **Strategy**: Lazy
    - **Program Types**: Movies only
