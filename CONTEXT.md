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
