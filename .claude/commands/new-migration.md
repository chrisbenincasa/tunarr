---
allowed-tools: Bash(cd server && pnpm drizzle-kit:*), Bash(git diff:*), Bash(git status:*)
description: Generate a new Drizzle ORM migration after schema changes
argument-hint: Brief migration description (e.g. "add-channel-tags")
---

## Context

- Current schema changes: !`git diff --name-only HEAD | grep -E "^server/src/db/schema/"`
- Existing migrations: !`ls server/src/migration/`

## Your task

A schema change has been made and needs a migration generated.

1. Confirm there are uncommitted schema changes under `server/src/db/schema/`. If there are none, tell the user and stop.
2. Run `cd server && pnpm drizzle-kit generate` to generate the migration.
3. Show the contents of the newly created migration file.
4. Remind the user to review the migration before committing — Drizzle sometimes generates destructive statements (DROP COLUMN, DROP TABLE) that need manual adjustment.

Migration name hint from arguments: $ARGUMENTS
