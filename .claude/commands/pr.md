---
allowed-tools: Bash(git log:*), Bash(git diff:*), Bash(git status:*), Bash(git branch:*), Bash(git push:*), Bash(gh pr create:*), Bash(gh pr view:*)
description: Create a pull request targeting the correct branch per project conventions
argument-hint: Optional PR title or description hint
---

## Context

- Current branch: !`git branch --show-current`
- Commits ahead of main: !`git log --oneline origin/main..HEAD`
- Commits ahead of dev: !`git log --oneline origin/dev..HEAD`
- Changed files: !`git diff --name-only origin/main..HEAD`
- Git status: !`git status --short`

## Your task

Create a pull request following Tunarr's branching conventions:

**Branch targeting rules:**
- Target `dev` for:
  - Large features, meaning a new subsystem, a change spanning many packages, or one that lands over several PRs
  - Changes that aren't backwards compatible, such as fixes that require a database migration
- Target `main` for everything else: small to medium features, backwards-compatible fixes, `chore`, `build`, `ci`, `docs`, `refactor`, `test`, etc.
- Decide from what the change does, not just the commit prefix. A `feat` commit is not automatically `dev`; a `fix` that adds a migration under `server/src/migration/` is `dev`.
- If the commits are mixed, or the feature's size is ambiguous, ask the user which branch to target before proceeding

**Steps:**
1. Determine the correct target branch using the rules above
2. If there are uncommitted changes, stop and tell the user to commit first
3. Push the current branch to origin if not already pushed
4. Draft a PR title and body based on the commits and diff:
   - Title: concise, follows conventional commit style
   - Body: summary of what changed and why, plus a test plan checklist
5. Create the PR with `gh pr create` targeting the correct branch
6. Return the PR URL

Hint from arguments: $ARGUMENTS
