#!/usr/bin/env bash
#
# Lint the TypeScript files you have actually touched.
#
# Replaces `eslint --fix $(git diff --name-only HEAD -- './**/*.ts*' | xargs)`,
# which had two failure modes:
#
#   * An empty file list left eslint with no path arguments, so it fell back to
#     linting the entire monorepo. That exhausts the V8 heap (abort, exit 134)
#     and, because `--fix` rewrites files as it goes, it reformats whatever it
#     reached on the way down.
#   * Deleted paths were passed straight through and eslint died on the missing
#     file.
#
# Scope is the working tree by default: staged edits, unstaged edits, and
# untracked files. `--branch` additionally lints everything this branch has
# committed since it forked from the base ref. That is opt-in because `--fix`
# rewrites files, and on a long-lived branch the committed set is large -- it
# would silently reformat files the current task never touched.
set -euo pipefail

PATH="$(git rev-parse --show-toplevel)/node_modules/.bin:${PATH}"

PATTERNS=('*.ts' '*.tsx' '*.mts' '*.cts')
include_branch=0

usage() {
  cat <<'USAGE'
Usage: lint-changed [--branch]

  (default)   lint staged, unstaged and untracked TypeScript files
  --branch    also lint files committed on this branch since it forked
              from origin/main (override the base with LINT_BASE_REF)
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --branch) include_branch=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "lint-changed: unknown argument '$arg'" >&2; usage >&2; exit 2 ;;
  esac
done

resolve_base_ref() {
  local candidate
  for candidate in "${LINT_BASE_REF:-}" origin/main main; do
    if [ -n "$candidate" ] && git rev-parse --verify --quiet "$candidate" >/dev/null 2>&1; then
      printf '%s' "$candidate"
      return
    fi
  done
}

collect_working_tree() {
  git diff --name-only -z --diff-filter=ACMR HEAD -- "${PATTERNS[@]}"
  git ls-files -z --others --exclude-standard -- "${PATTERNS[@]}"
}

collect_branch() {
  local base merge_base
  base="$(resolve_base_ref)"
  if [ -z "$base" ]; then
    return
  fi
  merge_base="$(git merge-base "$base" HEAD 2>/dev/null || true)"
  if [ -n "$merge_base" ]; then
    git diff --name-only -z --diff-filter=ACMR "$merge_base" -- "${PATTERNS[@]}"
  fi
}

collect_all() {
  collect_working_tree
  if [ "$include_branch" -eq 1 ]; then
    collect_branch
  fi
}

files_list="$(collect_all | tr '\0' '\n' | grep -v '^$' | sort -u || true)"

if [ -z "$files_list" ]; then
  if [ "$include_branch" -eq 1 ]; then
    echo "lint-changed: no changed TypeScript files."
  else
    echo "lint-changed: no uncommitted TypeScript changes."
    echo "lint-changed: to lint what this branch has committed, run: pnpm lint-changed --branch"
  fi
  exit 0
fi

# Build an argv array rather than piping to xargs, so eslint's own exit code
# survives (xargs reports its own 123 for any non-zero child).
files=()
while IFS= read -r file; do
  if [ -n "$file" ]; then files+=("$file"); fi
done <<< "$files_list"

scope='working tree'
if [ "$include_branch" -eq 1 ]; then
  scope="working tree + branch since $(resolve_base_ref)"
fi
echo "lint-changed: linting ${#files[@]} file(s) [${scope}]"

exec eslint --fix --no-warn-ignored "${files[@]}"
