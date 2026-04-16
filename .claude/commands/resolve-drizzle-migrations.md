---
allowed-tools: Bash(git show:*), Bash(git checkout *:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(cd server && pnpm drizzle-kit generate:*), Bash(rm server/src/migration:*), Bash(ls:*), Bash(python3:*)
description: Resolve Drizzle migration conflicts by accepting upstream and regenerating local migrations
argument-hint: Upstream branch (default: main)
---

## Context

- Current branch: !`git branch --show-current`
- Merge state: !`git status --short server/src/migration/db/sql/`

## Your task

Resolve Drizzle ORM migration conflicts between the current branch and an upstream branch.
The upstream branch's migrations keep their original indices. The current branch's schema
changes are collapsed into a single freshly-generated migration at the next available index.

**Upstream branch:** `$ARGUMENTS` (default to `main` if empty).

### Steps

1. **Get both journals.** Read the upstream journal and the current branch's journal:
   - Upstream: `git show <upstream>:server/src/migration/db/sql/meta/_journal.json`
   - Ours: if mid-merge and the file is conflicted, use `git show HEAD:server/src/migration/db/sql/meta/_journal.json`. Otherwise read it from the working tree.

2. **Find the divergence point.** Walk both entry lists and find the last entry where `tag` matches at the same `idx`. Everything after that is either upstream-only or ours-only.

3. **Identify our branch-only migrations.** These are entries in our journal whose `tag` does not appear in the upstream journal. Record each one's:
   - SQL file: `server/src/migration/db/sql/<tag>.sql`
   - Snapshot: `server/src/migration/db/sql/meta/<idx>_snapshot.json`

4. **Accept upstream's migration state.** For each upstream-only entry (past the shared base), plus the journal itself:
   ```
   git checkout <upstream> -- server/src/migration/db/sql/<tag>.sql
   git checkout <upstream> -- server/src/migration/db/sql/meta/<idx>_snapshot.json
   git checkout <upstream> -- server/src/migration/db/sql/meta/_journal.json
   ```

5. **Remove our branch-only artifacts.** Delete the SQL and snapshot files identified in step 3:
   ```
   rm server/src/migration/db/sql/<tag>.sql
   rm server/src/migration/db/sql/meta/<idx>_snapshot.json
   ```

6. **Regenerate.** Run `cd server && pnpm drizzle-kit generate`. This diffs the current schema TypeScript against upstream's latest snapshot and produces a single correct migration.

7. **Verify.**
   - Read the updated `_journal.json` — confirm the new entry follows upstream's last entry.
   - Spot-check that the new snapshot's `prevId` matches the last upstream snapshot's `id`.
   - List the SQL directory and confirm no duplicate-numbered files or orphans.

8. **Report.** Summarize:
   - Migrations accepted from upstream (tags)
   - Migrations removed from our branch (tags)
   - New migration generated (index, tag, file path)
   - Remind the user to review the generated SQL before committing.
