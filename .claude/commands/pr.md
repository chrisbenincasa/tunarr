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
- `fix` commits → target `main`
- `feat` commits and large changes → target `dev`
- If the commits are mixed or ambiguous, ask the user which branch to target before proceeding

**Steps:**
1. Determine the correct target branch from the commit types above
2. If there are uncommitted changes, stop and tell the user to commit first
3. Push the current branch to origin if not already pushed
4. Draft a PR title and body based on the commits and diff:
   - Title: concise, follows conventional commit style
   - Body: summary of what changed and why, plus a test plan checklist
5. Create the PR with `gh pr create` targeting the correct branch
6. Return the PR URL

Hint from arguments: $ARGUMENTS
