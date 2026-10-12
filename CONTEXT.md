# Tunarr Web

Domain language for the Tunarr client-side web application (`@tunarr/web`). This context currently covers the channel-programming editor; extend it as other packages are documented.

## Language

### Channel programming

**Lineup**:
The ordered list of programs being edited for a channel, custom show, or filler list. Each entry carries a `uiIndex`, an `originalIndex`, and a cumulative `startTimeOffset`; the list tracks a `dirty` flag (modified since load) and keeps an `original` copy for reset. A pure domain module — no React or store dependencies.
_Avoid_: playlist, schedule (when you mean this editable ordered structure)

**LineupSchedule**:
A scheduling rule — time slots or random slots — that the server evaluates to produce a channel's programming. Distinct from a **Lineup**: the schedule is a rule, the lineup is the resulting editable program list.
_Avoid_: lineup, schedule

**Program lookup**:
A `Record<id, ContentProgram>` cache used to materialize condensed program references into full content programs. Lives outside the **Lineup** and is passed into materialization.
_Avoid_: program map, content map

**Editor**:
The client working state for one editable entity (channel, custom show, or filler list): the entity's metadata plus its **Lineup**.
_Avoid_: form, page state

### Infinite schedules

**Infinite schedule**:
A named set of **Placements** that several channels can share. Each channel generates its own timeline from it, extended forever as time passes. Distinct from a **LineupSchedule**, which belongs to one channel and produces a fixed **Lineup**.
_Avoid_: dynamic schedule, schedule template

**Slot**:
A reusable definition of what plays, in what order, and with what filler. A slot carries no timing and no length. A library slot can be placed by any number of infinite schedules. A private slot belongs to one schedule.
_Avoid_: slot template, block

**Placement**:
One use of a **Slot** inside a **Infinite schedule**. It holds when the slot plays, how much of it plays, and how it fits the schedule's grid.
_Avoid_: slot instance, schedule slot

**Preset**:
A built-in starting point for a new **Infinite schedule**, such as time slots or random slots. Applying a preset creates an ordinary infinite schedule, which keeps no link to the preset.
_Avoid_: template, mode, schedule type

**Spill over**:
How far content before an anchored **Placement** may run past the anchor's start time. Beyond it, the gap before the anchor gets filler or flex instead.
_Avoid_: overflow, run-over (in infinite schedules)

**Max start delay**:
How late an anchored **Placement** may start when earlier content ran long. Beyond it, the placement is skipped for that day.
_Avoid_: lateness, grace period
