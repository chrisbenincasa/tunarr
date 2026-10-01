# ErsatzTV next — B5 in and out points on every source

> **Status (09/30/2026):** Re-scoped and recorded in the main plan (§14 tier 3, §15.B, corrections table). Verified against upstream `091e174`. Remaining work is the Tunarr mapper test in §5 and the optional upstream graphics one-liner in §3.

Part of [`ersatztv-next-upstream-blockers-2026-09-30.md`](ersatztv-next-upstream-blockers-2026-09-30.md).

## 1. What the register said

"`in_point_ms` and `out_point_ms` are read only from the `Local` and `Http` source variants. A resolved dynamic item returning Lavfi or Rtsp silently gets an in-point of 0." The proposed fix was to read the fields from every variant.

## 2. What is true at `091e174`

- `Lavfi`, `Rtsp` and `Script` have **no** `in_point_ms` or `out_point_ms` field (`crates/ersatztv-playout/src/playout.rs:222-301`). The same holds at `ed95077`. There is nothing to read.
- An in-point sent on those variants vanishes during parsing, because `PlayoutItemSource` has no `deny_unknown_fields`. That is register item C2.
- `input_timing` (`channel_session.rs:1006-1017`) reads both fields from `Local` and `Http` only, which matches the schema.
- For the variants without the field, a seek is either meaningless (`Lavfi` generators, `Rtsp` live streams) or something the command controls (`Script`).
- Tunarr's `toSource` (`EtvNextPlayoutItemMapper.ts:208`) emits only `local` and `http`, both with in and out points. Tunarr has no stream source that maps to `rtsp` or `script`, and it emits `lavfi` only for error, flex and silence items, where in-point zero is correct.

**So Tunarr can't hit B5 today.** The real defect is that an unsupported field is silently dropped.

## 3. A smaller real bug

Graphics layers read the in-point from `Local` only (`channel_session.rs:502-510`). An `Http` watermark with an in-point starts at zero. Tunarr doesn't send in-points on watermarks, so this doesn't block anything. It is a one-line upstream fix, `fix: honor http in-points on graphics layers`, worth sending with any other small PR.

## 4. Where the useful part goes

- **C2** (main plan §15.C) asks for `deny_unknown_fields` on the playout model. With it, an in-point on a `Lavfi` item fails loudly at load instead of vanishing. That covers the risk B5 was meant to cover.
- Adding the attribute to an internally tagged enum such as `PlayoutItemSource` needs a check that serde honors it per variant. Verify that first, in the C2 PR.
- Upstream's own `examples/playout/playout.json` carries an unknown `generated_at` key, so C2 must fix the example in the same PR.

## 5. Tunarr follow-up

| Change                                                                                                                                    | Where                              |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Add a mapper test asserting that no `lavfi` source ever carries `in_point_ms` or `out_point_ms`. It guards the assumption in §2 for free. | `EtvNextPlayoutItemMapper.test.ts` |
| Move B5 out of tier 2 in the main plan, and correct its register row.                                                                     | main plan §14, §15.B               |

## 6. Done when

- B5 is reclassified in the main plan and the blockers tracker. Done 09/30/2026.
- The mapper test exists.
