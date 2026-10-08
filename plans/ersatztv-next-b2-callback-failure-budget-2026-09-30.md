# ErsatzTV next — B2 callback retry and failure budget

> **Status (10/07/2026):** Planned and grilled (decisions D1–D9 in §2). Upstream citations re-verified at `v0.2.0`, where the behavior is unchanged. The issue draft is written (§4) and ready to file. Nothing filed. Only callback retry gates shipping. The configurable fallback duration is optional and the failure budget is a follow-up.

Part of [`ersatztv-next-upstream-blockers-2026-09-30.md`](ersatztv-next-upstream-blockers-2026-09-30.md). The original argument is in main plan §15.B, "B2 in full." §1 below corrects part of it.

## 1. Verified state

### 1.1 Upstream at `091e174`

- `resolve_dynamic_item` (`channel_session.rs:1185`) makes one HTTP GET. Its timeout is the `Dynamic` source's `timeout_us`, default 10 seconds (`:1261`). Any transport, status or JSON error becomes `ChannelError::DynamicSourceFailure`. There is no retry.
- `transcode()` (`:305`) maps that error to `FallbackReason::ItemSelectionFailed` (`:373`) and plays the fallback item.
- The fallback length is `Duration::from_mins(1)` (`:1089`). `ItemSelectionFailed` has no `fallback_until`, so every failed callback costs 60 seconds.
- A transcode failure uses `FallbackReason::TranscodeFailed`, which runs until the item's `finish`.
- Nothing counts failures. The worker continues forever.
- The run loop asks for the next item when the buffer drops to 60 seconds, and drops to realtime below 30 seconds (`:267-269`).
- `main.rs:49-59` exits 0 for `IdleTimeout` and 1 for every other error.
- The playout schema accepts versions up to `0.0.5` (`playout.rs:15-18` at `v0.2.0`). Tunarr emits `0.0.5` (`EtvNextWorkspace.ts:12`).
- Open PR #212 changes how `transcode()` sets each pipeline's output duration. Expect to rebase on it.

### 1.2 Tunarr

- **The heartbeat already covers "Tunarr is down."** Tunarr touches the worker's `.heartbeat` (`EtvNextWorkspace.ts:164-177`). Upstream reaps a worker whose heartbeat is older than 90 seconds and exits 0. An orphaned worker ends itself.
- **Tunarr never restarts a worker.** `#onWorkerExit` (`EtvNextSession.ts:417`) ends the session on any exit, whatever the code.
- **`errorScreen: kill` is already handled.** The resolver route stops the session itself and answers 503 (`etvApi.ts:239-259`).
- **The resolver rarely returns 5xx.** It catches its own errors and answers 200 with an error-screen item (`EtvNextPlayoutWriter.ts:421-438`). A 5xx comes only from failures before that `try`, such as the channel lookup (`etvApi.ts:176`). The worker therefore sees mostly connection errors and timeouts.
- **A 503 for `kill` is safe to retry.** `stopInternal` revokes the session token before it kills the worker (`EtvNextSession.ts:341`), so a retry gets a 401 and stops.
- **The watchdog misses transcode failures.** It resets on every successful resolve. A channel whose callbacks succeed but whose items all fail to transcode plays fallback cards forever. For most error screens that matches the legacy pipeline. For `errorScreen: kill` it doesn't, because the legacy pipeline ends the stream and this backend never routes transcode failures through Tunarr.
- **The callback is idempotent.** The item id is `${channel.uuid}-${startMs}`, and resolution only reads. A retry can't double-record anything.
- **The flood guard tolerates retries.** It allows 60 callbacks per 10 seconds (`EtvNextPlayoutWriter.ts:96-104`).
- **A new worker has 30 seconds** to publish its first segment (`ReadyTimeoutMs`, `EtvNextWorkspace.ts:15`).
- The resolver-silence watchdog (`EtvNextSession.ts:54`, `:525`) ends a session after 5 minutes without a successful resolve.

## 2. Decisions

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Retry and the configurable fallback duration gate shipping. The failure budget does not. It goes in the same issue as a follow-up that lets Tunarr delete the watchdog. The heartbeat already handles the outage the budget was meant for.                                                                                                                                                                                                     |
| D2  | Retry parameters live on the playout `Dynamic` source, beside `timeout_us`. This bumps the playout schema to `0.0.6`, so an older binary refuses the file loudly instead of ignoring the fields.                                                                                                                                                                                                                                               |
| D3  | Two knobs, `retry_backoff_ms` and `retry_budget_ms`. Backoff grows exponentially with jitter, up to the remaining budget. The budget counts time inside attempts as well as waits, and each attempt's timeout is the smaller of `timeout_us` and the budget left. Jitter, the growth factor and the retryable conditions are fixed.                                                                                                            |
| D4  | Tunarr emits `timeout_us` of 20 seconds, `retry_budget_ms` of 25000 and `retry_backoff_ms` of 250. Tunarr also bounds its own resolution at about 15 seconds and answers with an error-screen item when it runs out, so slowness never reaches the worker as a timeout. That deadline is its own Tunarr item (§5.1).                                                                                                                           |
| D5  | Retry is off when the fields are absent (`retry_budget_ms` defaults to 0). Nothing changes for integrators who don't opt in, so the issue is a pure addition.                                                                                                                                                                                                                                                                                  |
| D6  | Only retry gates shipping. Once retries absorb short failures, the fallback only plays during a long outage, and a shorter fallback duration only trims black after recovery. It stays in the issue as optional. **Rule:** the fallback duration must be at least `retry_budget_ms`. Otherwise each failed cycle burns more buffer than it adds back, and viewers see a frozen player instead of black. D1 is amended by this.                 |
| D7  | Keep the failure budget as a follow-up, not a ship gate. Its Tunarr justification is transcode failures and `errorScreen: kill`, not "Tunarr is down." Until it lands, the compatibility notice says `kill` doesn't cover transcode failures on this backend.                                                                                                                                                                                  |
| D8  | The budget is one field, `fallback.max_consecutive_failures`. No time bound, because Tunarr would never set it. Tunarr sets it on every channel, 1 for `kill` and 4 for the rest. Four failed callbacks take about 5 minutes, which matches the watchdog's grace, so the watchdog can go. A non-`kill` channel now ends after four straight failed programs instead of showing error screens forever, and the next viewer gets a fresh worker. |
| D9  | When the resolver deadline fires, Tunarr abandons the slow work instead of cancelling it. Media server clients time out at 60 seconds (`BaseApiClient.ts:106`), so a stuck server leaves about two abandoned requests per channel. Cancellation as a general concept is noted in the plans repo, `tunarr/platform-request-cancellation.md`.                                                                                                    |

## 3. Proposed upstream change

### 3.1 Retry with backoff (gates shipping)

- Absent fields mean no retry (D5).
- New optional fields on `PlayoutItemSource::Dynamic`: `retry_backoff_ms: Option<u64>` and `retry_budget_ms: Option<u64>`. `retry_budget_ms: 0` disables retry.
- Wrap the GET in `resolve_dynamic_item` in a loop bounded by `retry_budget_ms`.
- Retry transport errors, timeouts and 5xx. Don't retry 4xx or a JSON parse error, because those are answers, not outages.
- Wait a jittered, exponentially growing delay between attempts, starting from `retry_backoff_ms` and never past the budget left.
- Log each attempt at `warn`, and the final failure at `error`.
- Bump `SUPPORTED_SCHEMA` to `0.0.6` and hand-edit `schema/playout.json` (C6, upstream maintains it by hand).

### 3.2 Configurable fallback duration (optional, does not gate shipping)

- New `fallback.duration_seconds: Option<u32>` in the channel config, default 60. It replaces the literal at `:1089`.
- It sets how long black plays after a failed callback before the worker asks again.
- It must be at least `retry_budget_ms` (D6).
- Regenerate `schema/channel_config.json` with `gen_channel_config_schema`.

### 3.3 Failure budget (follow-up, does not gate shipping)

- Why: a worker whose items keep failing to transcode plays fallback cards forever, and nothing outside it can tell (D7).
- New `fallback.max_consecutive_failures: Option<u32>` (D8). Unset keeps today's behavior.
- `ItemSelectionFailed` and `TranscodeFailed` count. `ScheduledGap` doesn't. A successful non-fallback item resets the count.
- Past the bound, write the fallback dossier (`:1405`) and exit with a distinct code, proposed `3`.

### 3.4 Tests

- Unit tests for the retry classifier, which errors retry and which don't.
- Unit tests for the backoff schedule. The budget must hold with attempt time included, and an attempt's timeout must shrink to the budget left.
- One integration test with a local HTTP server that fails N times, then succeeds, and asserts the item plays.
- One integration test with a server that hangs, asserting the total time stays inside the budget.
- For the follow-up, unit tests for the budget counter, extracted into a small struct. `channel_session.rs` has no tests today.

## 4. Design issue

Re-verified at `v0.2.0`: one GET in `resolve_dynamic_item` (`channel_session.rs:1342`), 10-second default timeout (`:1416-1418`), one minute of fallback (`:1297`), and no `fallback_until` for `ItemSelectionFailed` (`fallback.rs:65`).

Left out on purpose:

- The B1 work-ahead pairing, to keep the issue to one topic. Its citations are not re-verified at `v0.2.0`.
- Tunarr's own timings (D4), so the case stands without Tunarr.

### Draft

**Title:** feat: retry dynamic callbacks

> When a `Dynamic` source's callback fails, the channel plays a minute of fallback and asks again on the next `transcode()`. Nothing retries, so one dropped connection or a server mid-restart costs 60 seconds of black (`channel_session.rs:1297`; `ItemSelectionFailed` has no `fallback_until`, `fallback.rs:65`).
>
> I'd like to add retry with backoff, off by default:
>
> - Two optional fields on `PlayoutItemSource::Dynamic`, `retry_budget_ms` and `retry_backoff_ms`. Absent, or a budget of 0, keeps today's behavior.
> - Retry transport errors, timeouts and 5xx. Don't retry 4xx or a body that doesn't parse, since those are answers rather than outages.
> - Backoff grows exponentially with jitter, starting at `retry_backoff_ms`. The budget includes time spent inside attempts, so each attempt's timeout is the smaller of `timeout_us` and the budget left.
> - Playout schema goes to 0.0.6, so an older build rejects the file instead of silently ignoring the fields.
>
> Two questions before I send a PR:
>
> 1. Do the names and the placement on the `Dynamic` source work for you, or would you rather this live in the channel config?
> 2. Would you take a `fallback.duration_seconds` channel config field to replace the hardcoded minute? It's optional for us. If it lands, it should be at least the retry budget, or each failed cycle drains more buffer than it adds.
>
> Later, as a separate PR: `fallback.max_consecutive_failures`, which exits with a distinct code (say 3) after N straight failed items. Today the worker can't tell "this item failed" from "this channel is broken," so an integrator has no signal for the second.

## 5. Tunarr follow-up

### 5.1 Resolver deadline (independent of upstream)

- Bound `resolveDynamicItem` (`EtvNextPlayoutWriter.ts:357`) at about 15 seconds.
- On expiry, answer with `safeResolverErrorItem`, the same error-screen item the resolver uses for other failures.
- Log which step ran out of time, usually `resolveStream`.
- Abandon the slow work rather than cancel it (D9).
- The error item is a normal 200 lasting 30 seconds (`ResolverErrorItemMs`). So a stuck media server never counts toward upstream's failure budget or the watchdog. The channel shows Tunarr's error screen until the server recovers, as on the legacy pipeline. `kill` channels still end, because building the error item throws for `kill`.
- 15 seconds plus ffmpeg startup fits inside the 30-second ready limit for a new worker.
- Can land now, before any upstream change.

### 5.2 `kill` compatibility notice (independent of upstream)

- Add a notice for `errorScreen: kill` saying transcode failures play a fallback card instead of ending the stream on this backend.
- Add the same line to `docs/configure/ffmpeg/ersatztv-next.md`.
- Remove both when §5.4 lands.

### 5.3 After the pin bump

| Change                                                                                                                    | Where                                                    |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Emit playout version `0.0.6`, and `timeout_us`, `retry_budget_ms` and `retry_backoff_ms` on the dynamic placeholder (D4). | `EtvNextWorkspace.ts:12`, `EtvNextDynamicPlayout.ts`     |
| If the optional field landed, emit `fallback.duration_seconds` of 30.                                                     | `EtvNextChannelConfigMapper.ts`, `fallback` block `:397` |
| Pin bump per blockers plan §5.                                                                                            | —                                                        |

### 5.4 After the failure budget lands

| Change                                                                                                                       | Where                                         |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Emit `max_consecutive_failures` on every channel, 1 for `kill` and 4 otherwise (D8). Remove the §5.2 notice.                 | `EtvNextChannelConfigMapper.ts`               |
| Log exit code 3 as "channel dead" in `#onWorkerExit`. The session already ends on any exit.                                  | `EtvNextSession.ts:417`                       |
| Delete the resolver-silence watchdog, `ResolverSilenceGraceMs` (`:54`) and `#checkResolverSilence` (`:525`), with its tests. | `EtvNextSession.ts`, `EtvNextSession.test.ts` |

## 6. Done when

- A tagged upstream release retries callbacks.
- Tunarr bounds its resolver and emits the retry fields.
- The failure budget and watchdog removal are tracked separately and don't block shipping.
