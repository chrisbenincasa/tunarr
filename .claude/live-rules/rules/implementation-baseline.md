---
description: Tunarr implementation baseline
globs: ["server/src/**", "web/src/**", "shared/src/**", "types/src/**"]
priority: 80
---
- Trace the real flow before editing. Ask whether the change needs to exist at all.
- Search for an existing helper, repository method, or pipeline step before writing a new one.
  Prefer dependencies already in the workspace catalog over adding packages.
- Fix the bug where the bad value is born, not where it surfaces. A Jellyfin/Emby canonicalizer
  bug gets fixed in the canonicalizer, not patched in the DB layer or the UI.
- Keep Zod validation at trust boundaries: API route inputs and responses from Plex, Jellyfin,
  Emby, and local media probes.
- Non-trivial logic ships with a Vitest regression test. Name what the test exercised, and never
  imply a mocked media-server test ran against a real server.
- Run `pnpm lint-changed` and the affected package's typecheck before calling the change done.
