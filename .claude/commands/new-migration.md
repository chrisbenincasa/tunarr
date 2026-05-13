---
allowed-tools: Bash(cd server && pnpm drizzle-kit:*), Bash(git diff:*), Bash(git status:*), Bash(date +%s), Read, Edit
description: Generate a new Drizzle ORM migration after schema changes
argument-hint: Brief migration description (e.g. "add-channel-tags")
---

## Context

- Current schema changes: !`git diff --name-only HEAD | grep -E "^server/src/db/schema/"`
- Existing migrations: !`ls server/src/migration/db/sql/`

## Your task

A schema change has been made and needs a migration generated. Drizzle generates the SQL file, but Kysely's `DirectMigrationProvider` is what actually runs migrations at startup — both steps are mandatory.

1. Confirm there are uncommitted schema changes under `server/src/db/schema/`. If there are none, tell the user and stop.
2. Run `cd server && pnpm drizzle-kit generate` to generate the migration SQL file.
3. Show the contents of the newly created migration file.
4. Register the migration in `server/src/migration/DirectMigrationProvider.ts`:
   a. Generate a Unix timestamp key: `date +%s`
   b. Add an entry at the END of the `getMigrations()` object (Kysely runs migrations in alphanumeric ascending order):
      ```typescript
      migration<TIMESTAMP>: makeKyselyMigrationFromSqlFile(
        './sql/<GENERATED_FILENAME>.sql',
      ),
      ```
      The `makeKyselyMigrationFromSqlFile` import already exists at the top of the file.
5. Remind the user to review the migration before committing — Drizzle sometimes generates destructive statements (DROP COLUMN, DROP TABLE) that need manual adjustment.

Migration name hint from arguments: $ARGUMENTS
