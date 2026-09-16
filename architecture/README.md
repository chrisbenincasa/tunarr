# Architecture exploration — @tunarr/web

Durable records for the six architecture candidates surfaced in the web-package review. This directory is the persistent copy — the review HTML report lives in `/tmp` and is ephemeral.

## Candidates

| # | Candidate | Status | Record |
|---|-----------|--------|--------|
| 1 | Collapse the three editors into one **Lineup** module | Deep dive complete · plan recorded · **not implemented** | [01-editor-collapse.md](./01-editor-collapse.md) |
| 2 | Own the **API seam** — one client, one query-key scheme | Grilling in progress (3 branches open) | — |
| 3 | Own the **form seam** — decouple the model from react-hook-form | Pending | — |
| 4 | Extract the deep **lineup transforms** from behind their hooks | Pending | — |
| 5 | Split **server cache** from UI state; prune dead/derived state | Pending | — |
| 6 | Break the **pages ↔ routes** cycle; centralize navigation | Pending | — |

## Domain language

Terms are recorded in [`CONTEXT.md`](/CONTEXT.md): **Lineup**, **LineupSchedule**, **Program lookup**, **Editor**.

## How to resume

- To implement candidate #1, follow the nine-step plan in `01-editor-collapse.md`.
- To continue designing candidate #2, start from its three open branches: which client is the seam, how `baseURL` reaches the client per-request, and whether generated query options become the single query layer.
