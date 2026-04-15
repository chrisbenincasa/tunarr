---
allowed-tools: Bash(cd server && pnpm generate-openapi:*), Bash(cd web && pnpm generate-client:*), Bash(cd web && pnpm regen-routes:*), Bash(git diff:*)
description: Regenerate the OpenAPI spec and web API client after server API changes
---

## Context

- Changed API/types files: !`git diff --name-only HEAD | grep -E "^(server/src/api/|types/src/)"`

## Your task

Regenerate the full API contract chain after server-side changes:

1. **Generate OpenAPI spec** — run `cd server && pnpm generate-openapi`
2. **Regenerate web client** — run `cd web && pnpm generate-client`
3. **Regenerate TanStack Router routes** — run `cd web && pnpm regen-routes`
4. Show a summary of what changed: `git diff --stat -- web/src/generated/`

Do these steps in order (each depends on the previous). Report any errors immediately and stop.
