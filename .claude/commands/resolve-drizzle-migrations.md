---
allowed-tools: Bash(cd server && pnpm resolve-migrations:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(ls:*), Read, Edit
description: Resolve Drizzle migration conflicts by accepting upstream and regenerating local migrations
---

## Context

- Current branch: !`git branch --show-current`
- Unmerged files: !`git diff --name-only --diff-filter=U`

## Your task

Resolve Drizzle ORM migration conflicts during an in-progress merge, rebase, or cherry-pick.
`server/scripts/resolve-migrations.ts` does the work. Upstream's migrations keep their indices.
This branch's migrations are deleted, regenerated as one migration on top of upstream's latest
snapshot, and registered in `DirectMigrationProvider.ts`.

### Steps

1. **Resolve schema conflicts first.** If any file under `server/src/db/schema/` is unmerged,
   resolve it and `git add` it. The migration is generated from the resolved schema.
2. **Check the provider.** If `server/src/migration/DirectMigrationProvider.ts` is conflicted and
   the branch changed more than its SQL migration registrations (e.g. a hand-written TS migration),
   resolve it by hand, keeping both sides. Otherwise leave it; the script handles it.
3. **Run the script.** `cd server && pnpm resolve-migrations`. drizzle-kit may prompt about column
   renames. If it does, stop and ask the user.
4. **Verify.** Read the generated SQL and the new registry entry. Confirm no unmerged files remain
   under `server/src/migration/`.
5. **Report.**
   - Migrations accepted from upstream (tags)
   - Migrations removed from this branch (tags)
   - New migration (tag, registry key)
   - Remind the user to review the SQL, reset their dev DB if it ran the old migration, and
     continue the merge or rebase.
