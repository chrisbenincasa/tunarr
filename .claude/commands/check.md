---
allowed-tools: Bash(pnpm turbo:*), Bash(pnpm lint-changed:*)
description: Run typechecking, lint, and tests across all packages
---

## Your task

Run the full static analysis and test suite for the monorepo:

1. **Typecheck all packages** — run `pnpm turbo typecheck`
2. **Lint changed files** — run `pnpm lint-changed`
3. **Run all tests** — run `pnpm turbo test`

Run these in sequence. After all three complete, summarize:
- Any type errors (package, file, line)
- Any lint errors or warnings
- Any test failures (suite, test name, error)
- Overall pass/fail status

If everything is clean, say so clearly. Do not attempt to fix errors unless the user asks.
