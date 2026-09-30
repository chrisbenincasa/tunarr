# Testing

*Last Updated: 2026-09-29*

- Vitest everywhere. Tests sit next to the code as `*.test.ts`.
- `server` runs tests with type-checking: `vitest --typecheck.tsconfig tsconfig.test.json --run`.
  `pnpm test:local` uses `server/vitest.local.config.ts`.
- Coverage uses `@vitest/coverage-v8`, which is installed in `server` and `shared` but not `web`.

## Server integration tests (`server/tests/`)

- `server/tests/testServer.ts` exports `initTestApp`, which boots the real Fastify app against a
  temp directory database.
- `server/tests/support/seed.ts` seeds data. `support/probe.ts` fires concurrent HTTP probes
  at the test app to measure latency under load.
- Contract tests: `channelWriteContract.test.ts`, `lineupResponseEquivalence.test.ts`,
  `channelProgrammingValidation.test.ts`, `settingsPartialUpdate.test.ts`.
- Perf check: `tests/perf/slotSaveLag.test.ts`.

## Unit-test helpers

- `server/src/testing/` holds shared fakes (`fakes/`), FFmpeg test helpers (`ffmpeg/`), custom
  matchers, and `testDbFactory.ts` for unit tests.
- There are no recorded Plex, Jellyfin, or Emby response fixtures in the repo, so client tests
  mock the HTTP layer.
