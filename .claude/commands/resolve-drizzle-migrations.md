---
allowed-tools: Bash(git show:*), Bash(git checkout *:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(cd server && pnpm drizzle-kit generate:*), Bash(rm server/src/migration:*), Bash(rm -f /tmp/drizzle*), Bash(ls:*), Bash(python3:*), Bash(node /tmp/drizzle*), Write(/tmp/drizzle*)
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

6. **Regenerate.** Run `cd server && pnpm drizzle-kit generate`.
   This diffs the current schema TypeScript against upstream's latest snapshot and produces a single correct migration.

   **IMPORTANT — interactive TUI handling:** `drizzle-kit generate` uses an interactive
   terminal UI (not stdin) to ask "Is X table created or renamed from another table?" for
   each table that was added or removed between the old snapshot and the current schema.
   Piping input does not work — the TUI reads from the TTY directly.

   To automate this, write a temporary Node.js script at `/tmp/drizzle-interact.js` that
   uses `node-pty` (available globally via `@google/gemini-cli`) to spawn the process in a
   pseudo-terminal and respond to each prompt:

   ```js
   const pty = require('/home/christian/.nvm/versions/node/v22.14.0/lib/node_modules/@google/gemini-cli/node_modules/node-pty');

   const proc = pty.spawn('pnpm', ['drizzle-kit', 'generate'], {
     cwd: '/home/christian/Code/tunarr-infinite-schedules/server',
     cols: 120, rows: 30,
   });

   let pendingData = '';
   let debounce = null;
   const answered = new Set();

   function stripAnsi(s) {
     return s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\[\?[0-9]+[hl]/g, '');
   }

   proc.onData((data) => {
     pendingData += data;
     process.stdout.write(data);
     clearTimeout(debounce);
     debounce = setTimeout(() => {
       const clean = stripAnsi(pendingData);
       const match = clean.match(/Is (\S+) table created or renamed from another table\?/g);
       if (!match) return;
       const tableMatch = match[match.length - 1].match(/Is (\S+) table/);
       if (!tableMatch) return;
       const tableName = tableMatch[1];
       if (answered.has(tableName)) return;
       answered.add(tableName);
       // Decide: rename or create. Check if "rename table" is an option AND the table
       // is a known rename (compare columns in the upstream snapshot vs schema).
       // Default to "create table" (first option = just press Enter).
       // For renames, press arrow-down first to select the second option.
       const isRename = false; // <-- set true for known renames, see below
       if (isRename) {
         proc.write('\x1b[B'); // arrow down
         setTimeout(() => proc.write('\r'), 200);
       } else {
         proc.write('\r'); // accept default (create)
       }
       pendingData = '';
     }, 1500);
   });

   proc.onExit(({ exitCode }) => { process.exit(exitCode); });
   ```

   **Before writing the script**, compare the upstream snapshot's table list against the
   current schema to identify true renames (same columns, different table name) vs. new
   tables. Set `isRename` logic accordingly (e.g. check `tableName === 'channel_fallback'`
   for a known `channel_custom_show` → `channel_fallback` rename). Run with
   `node /tmp/drizzle-interact.js` and clean up the temp file afterward.

   If `node-pty` is not available at the expected path, fall back to asking the user to run
   `pnpm drizzle-kit generate` manually and answer the prompts themselves.

7. **Verify.**
   - Read the updated `_journal.json` — confirm the new entry follows upstream's last entry.
   - Spot-check that the new snapshot's `prevId` matches the last upstream snapshot's `id`.
   - List the SQL directory and confirm no duplicate-numbered files or orphans.

8. **Report.** Summarize:
   - Migrations accepted from upstream (tags)
   - Migrations removed from our branch (tags)
   - New migration generated (index, tag, file path)
   - Remind the user to review the generated SQL before committing.
