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

Tunarr uses CalVer, so a release number says when it shipped, not what changed. Small and medium features ship on stable as soon as they're ready, and `dev` holds only work that needs several prereleases before it's ready.

- Target `main` by default. This covers fixes, `chore`, `build`, `ci`, `docs`, `refactor`, `test`, and small to medium `feat` work.
- A database migration does not by itself send a PR to `dev`. Target the branch the change would go to without it.
- Target `dev` only for large features that will likely need many prerelease iterations before they debut on stable. Examples are infinite schedules and remote streaming sources. Signs of this kind of work:
  - it spans many PRs or lands in stages
  - it changes core subsystems like scheduling, streaming, or the media source model
  - it would be half-finished or unstable if released on its own
- If the branch was cut from `dev`, target `dev`. The branch sits on `dev` when "Commits ahead of main" lists commits that "Commits ahead of dev" does not. A PR from it to `main` would pull unreleased `dev` work into stable. If the change belongs on `main`, tell the user to rebase onto `main` instead.
- If a `feat` PR's size is unclear, ask the user which branch to target before proceeding.

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
