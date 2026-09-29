# Plan: Stream Selection UI — Remaining Work

## Context

The `stream-selector-ui` branch adds a profile editor (list, create/edit/delete, rule editor, Basic↔CEL condition builder) on top of the server-side stream selection pipeline (`StreamSelectionProfileResolver` → `StreamSelectionEvaluator` → `FfmpegStreamFactory`).

The editor is largely done, but profiles have no effect yet: `streamSelectionProfileId` exists on the `channel`, `filler_show`, and `program` tables and the resolver reads it, but no API or UI writes it. Every stream uses the legacy profile synthesized from global ffmpeg language preferences plus channel subtitle preferences.

This plan replaces the legacy path entirely: every stream resolves through profiles, ending at a user-chosen default and a locked built-in. All design decisions were settled in a grilling session on 2026-09-27 (see "Design Decisions (resolved)").

## Task List

### PR 1 — Engine, migration, assignment, docs (target: `main`, #1876)

- [x] **1. Resolver cascade**
  - [x] Resolver returns an ordered chain: program → source (custom show *or* filler list) → channel → default pointer → built-in (D1, D2)
  - [x] Evaluator walks the chain; cascades only when no rule condition matches (D3)
  - [x] Provenance: result records the matching level + profile (D4)
  - [x] Evaluator no-match path no longer returns `audioStreams[0]` (replaced by cascade)
- [x] **2. Custom-show level** (D2)
  - [x] Populate `customShowId` in `StreamProgramCalculator.ts:366` (slot iterators and stored lineups already carry it)
  - [x] `custom_show.stream_selection_profile_id` column + migration (`pnpm drizzle-kit generate`)
  - [x] Resolver: custom show and filler list form one "source" level; if both IDs are present, log a warning and pick deterministically
- [x] **3. Built-in profile + default pointer** (D6, D7)
  - [x] `locked` column on `stream_selection_profiles`; seed the built-in row with a fixed UUID (first audio via default heuristic, no subtitles)
  - [x] API rejects update/delete of locked profiles
  - [x] Default pointer in settings (`settings.json`); reset to built-in when its target is deleted
- [x] **4. Remove subtitle gate** (D5) — delete the `subtitlesEnabled` checks in `FfmpegStreamFactory.buildTranscodeInputs` (:535) and `buildPassthroughSubtitles` (:625-630)
- [x] **5. Legacy → profile fixer (release N)** (D8, D9)
  - [x] One-shot fixer in `tasks/fixers/` with a done marker in settings
  - [x] "Migrated Defaults" profile = global `languagePreferences` audio + subtitles `disable`; point the default pointer at it (skip if there is nothing to migrate)
  - [x] One profile per distinct subtitle config among channels with subtitles on, named from content (e.g. "Migrated: eng, spa subtitles"); assign to those channels
  - [x] Old columns / subtitle-preferences table / `languagePreferences` are left in place, unused
- [x] **6. Profile deletion** (D10) — null `channel`/`filler_show`/`program`/`custom_show` references in app code inside the delete transaction; reset the default pointer if needed
- [x] **7. Assignment API**
  - [x] Channel: add `streamSelectionProfileId: z.uuid().nullable()` to `ChannelSchema` (`SaveableChannelSchema` inherits it as optional; `null` clears, omitted leaves unchanged); validate existence in `channelsApi` POST/PUT (400); map in `BasicChannelRepository` save/update/copy and `channelConverters`
  - [x] Filler list: same field on filler list schemas, API, and repository
  - [x] Custom show: same field on custom show schemas, API, and repository
  - [x] Usage: `GET /stream-selection-profiles` returns the channels, filler lists, and custom shows using each profile (not just counts)
  - [x] Regenerate OpenAPI spec + web client
- [x] **8. Assignment UI** (D11, D12, D13)
  - [x] Channel Transcoding tab, "Audio & Subtitles" section: profile select (`Default (<name>)` + profiles), Edit / Create new links; remove the `subtitlesEnabled` toggle and `ChannelSubtitlePreferencesTable`
  - [x] Same select in `EditFillerListForm.tsx` and the custom show editor
  - [x] Profiles list page: default pointer select, locked built-in (lock icon; View read-only + Duplicate only), "Set as default" row action, "Default" chip
  - [x] Usage counts become a popover listing channels / filler lists / custom shows with links
  - [x] Delete confirmation lists usage and warns when deleting the default target
  - [x] Remove global language preferences from Settings → FFmpeg
- [x] **9. Evaluator trace + Troubleshoot refactor** (D14)
  - [x] Evaluator returns a trace per level walked: `{level, profileId, profileName, rules[{label, condition, matched}], chosen}`
  - [x] `TroubleshootService` calls the evaluator instead of its own rule loop (fixes subtitle drift; passes `fillerListId`/`customShowId`); UI renders the cascade trace
- [x] **10. Docs** (D18)
  - [x] `docs/configure/stream-selection.md`: concepts; resolution order (source → channel → default → built-in; program omitted); built-in + default pointer; upgrade notes; rule/action reference + CEL field table; recipes; debugging with Troubleshoot
  - [x] Update `docs/misc/troubleshooting.md` cross-links; remove/redirect docs for channel subtitle preferences and global language preferences
- [x] **11. Tests**
  - [x] Resolver/evaluator: cascade order, source level, matched-rule finality, built-in fallback, provenance
  - [x] Fixer: dedup, naming, pointer, idempotency (done marker), nothing-to-migrate case
  - [x] API: set/clear/copy/invalid id → 400 for channel, filler, custom show; locked profile update/delete rejected; delete nulls references and resets pointer
  - [x] Factory: profile subtitle action applies regardless of the old toggle
- [x] **12. QA** (D19) — Claude drives Chrome against `pnpm turbo dev`, records GIFs, checklist in the PR description:
  - [x] Transcode config page restructure: create/edit/cancel, unsaved-changes alert, advanced toggle, nav/breadcrumbs, Save button
  - [x] Profiles page: default pointer, built-in view/duplicate, usage popover, delete + confirm
  - [x] Channel / filler / custom show selects
  - [x] Migration on a seeded DB with mixed legacy subtitle configs — verify dedup and naming
  - [ ] Troubleshoot cascade trace (not run: QA DB has no media or FFmpeg; covered by evaluator chain tests)

### PR 2 — Preview + Basic-mode fields (target: `main`)

- [ ] **13. Rule preview** (D15, D16)
  - [x] `POST /stream-selection-profiles/preview`: inline unsaved profile + program ID + optional channel ID; evaluates only that profile; reports "no match — would cascade" without cascading
  - [x] Collapsible "Test" panel at the bottom of the editor: program search, optional channel select, Run button, per-rule matched/unmatched, chosen streams, highlight winning rule; remember last program for the session; "Troubleshoot on channel X" link
- [ ] **14. CEL context + Basic-mode fields** (D17)
  - [ ] Add `program.showTitle`, `program.genres` (episode ∪ show genres), `program.libraryId` to the CEL context (loaded at stream start)
  - [ ] Basic builder: show title / program title (`==`, `!=`, `contains`); genre (`in`, picker from Genre table); library (`==`, picker)
  - [ ] `celParser` / `celGenerator` round-trip; unrecognized CEL stays in CEL mode
- [ ] **15. Docs** — preview, new fields, genre/library recipes (e.g. anime → jpn audio + eng subs)
- [ ] **16. QA** — preview panel and new Basic-mode fields in Chrome

### Release N+1 — chore PR

- [ ] Drizzle migration: drop `channel.subtitles_enabled` and the channel subtitle-preferences table; rebuild `channel`, `filler_show`, `program`, `custom_show` FKs with `ON DELETE SET NULL` (migration `0044_useful_groot.sql` shipped in v1.3.0 without it)
- [ ] Settings migration: drop ffmpeg `languagePreferences`
- [ ] Delete legacy profile synthesis code; optionally keep the app-code null-out as a safety net

### Deferred

- Program-level assignment (column + resolver step stay, unreachable; needs its own design for placement, show/season fan-out, bulk)
- Resolved profile shown in `ChannelsPage` / quick stats
- Bulk assignment from the profile page
- `fillerType` in the CEL context
- Channel name/number in Basic mode (remain available in CEL)
- Regex (`matches`) in Basic mode

## Design Decisions (resolved)

Settled 2026-09-27.

- **D1. Resolution order:** program (deferred, unreachable) → source → channel → default pointer → locked built-in.
- **D2. Source level:** custom show and filler list are one level; an item never legitimately carries both. The filler level applies only when the item plays *as filler* (commercial stream item). Slot-materialized filler already persists `fillerListId` through `MaterializeLineupCommand` / `LineupRepository`, and `StreamProgramCalculator.ts:357-364` turns it into a commercial item. Channel fallback clips (`fallback` items) resolve at the channel level.
- **D3. Cascade semantics:** move to the next level only when no rule *condition* matches. A matched rule is final: if its action finds nothing, audio uses the default heuristic and subtitles are none. Authors who want "X if present" put the check in the condition.
- **D4. Provenance:** the resolved result and traces record the matching level and profile.
- **D5. Subtitles:** the profile owns subtitles. The `subtitlesEnabled` gate in `FfmpegStreamFactory` is deleted, and the channel toggle is removed from the UI.
- **D6. Built-in profile:** a seeded row with a `locked` flag and a fixed UUID, containing first audio (default heuristic) and no subtitles. It cannot be edited or deleted, can be viewed and duplicated, and can be explicitly assigned.
- **D7. Default pointer:** a global setting, set on the profiles list page. It starts at the built-in, or at "Migrated Defaults" after migration, and resets to the built-in if its target is deleted.
- **D8. Legacy removal:** the whole legacy path goes away, including global language preferences, the channel subtitle toggle and preferences, and legacy synthesis.
- **D9. Migration mechanism:** release N runs a one-shot fixer (with a done marker) that deduplicates by subtitle config and leaves the source data in place. Release N+1 drops the old columns and settings. A buggy fixer can be fixed and re-run from the source data.
- **D10. FK behavior:** migration `0044` shipped in v1.3.0 with plain `REFERENCES`, and the Drizzle schema says `set null`. Release N nulls references in app code on delete. Release N+1 rebuilds the FKs along with the column drops. If `drizzle-kit generate` emits the rebuild earlier, accept it.
- **D11. Channel selector placement:** the Transcoding tab's "Audio & Subtitles" section. The "Default" option shows the name of the pointer's target.
- **D12. Default pointer UI:** on the profiles list page, not in FFmpeg settings.
- **D13. Assignment visibility:** usage counts become a popover with links. Channel columns and bulk assignment are deferred.
- **D14. Troubleshoot:** refactored to call the evaluator, which returns per-level traces. This must land before preview, and it ships in PR 1.
- **D15. Preview scope:** evaluates only the edited, unsaved profile (with an optional channel for CEL context), plus a link to Troubleshoot for the full saved cascade.
- **D16. Preview UI:** a collapsible Test panel at the bottom of the editor with a manual Run button.
- **D17. Basic mode:** adds show and program title, genres (the union of episode and show genres), and library. No channel fields and no regex. Unrecognized CEL stays in CEL mode.
- **D18. Docs:** `docs/configure/stream-selection.md` with the outline in task 10. Program is left out of the documented order until it's reachable.
- **D19. Delivery:** PR 1 (engine, migration, assignment, docs) and PR 2 (preview, Basic-mode fields), both targeting `main`, followed by an N+1 chore PR. Claude runs QA in Chrome with GIFs.
- **Program-level assignment:** deferred (see Deferred).
