# Architecture exploration — @tunarr/server

Durable records for the architecture candidates surfaced in the server-package review. This directory is the persistent copy — the review HTML report lives in `/tmp` and is ephemeral.

## Candidates

| # | Candidate | Status | Record |
|---|-----------|--------|--------|
| 1 | Own the request seam — retire the ambient **ServerContext** | Pending | — |
| 2 | One schedule evaluation — evaluate→convert→persist, validated everywhere | Pending | — |
| 3 | One update-channel operation — stop re-deriving handler choreography | Pending | — |
| 4 | Delete the DB facades; one query dialect behind each repository | Pending | — |
| 5 | The media-source seam — one mapping, one library diff, one route adapter | Pending | — |
| 6 | Unify the transcode target — one state assembler | Pending | — |
| 7 | One subtitle selector | Pending | — |
| 8 | One channel lifecycle — pause/resume/cleanup reconciles | Pending | — |
| 9 | Mint once — one program-row assembler; db/ stops importing api/ | Pending | — |
| 10 | A pure guide timeline — extract the algorithm from TvGuideService | Pending | — |
| 11 | One slot-emission pipeline — and delete midRollUtil | Pending | — |
| 12 | One run-a-unit-of-work seam — and inject the Scheduler | Pending | — |
| 13 | Object-shaped pipeline builder seam | Pending | — |

## Smaller frictions (observed, unranked)

- Scan loop duplicated ×10 + off-interface client methods + static coordinator state
- NFO schema + array-tag drift
- external/ writes DB + schedules tasks
- LineupRepository spans two storage engines (SQLite + per-channel JSON)
- CLI and server duplicate bootstrap
- Static singletons + concrete-vs-symbol token drift beside DI
- StreamProgramCalculator: a read path that mutates
- FfmpegTranscodeSession pass-through (speculative)
- Two disconnected event mechanisms (speculative)

## Domain language

Terms are recorded in [`CONTEXT.md`](/CONTEXT.md); server-side terms to be added during grilling as deepened modules are named.

## How to resume

- To continue designing a candidate, start from its card in the review report and grill the design tree with the user (shape of the deepened module, what sits behind the seam, which tests survive).
- Each settled deep-dive gets a `NN-<slug>.md` record in this directory, following the format of the web package's `01-editor-collapse.md`.
