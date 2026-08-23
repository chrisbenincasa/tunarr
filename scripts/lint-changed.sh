#!/usr/bin/env bash
#
# Lint the TypeScript files this working copy has actually touched.
#
# Replaces `eslint --fix $(git diff --name-only HEAD ...)`, which had two
# failure modes:
#
#   * An empty file list left eslint with no path arguments, so it fell back to
#     linting the entire monorepo and exhausted the V8 heap (abort, exit 134).
#     The list went empty precisely when you committed first and then ran the
#     check, which is the normal time to run it.
#   * Deleted paths were passed straight through and eslint died on the missing
#     file.
#
# Committed-but-unmerged work counts as changed. Otherwise the check reports
# "nothing to lint" on a branch that plainly has changes, which is a gate that
# passes by doing nothing.
set -euo pipefail

# Direct execution has to work too, not just `pnpm lint-changed`, which is the
# only context that puts the workspace binaries on PATH for us.
PATH="$(git rev-parse --show-toplevel)/node_modules/.bin:${PATH}"

PATTERNS=('*.ts' '*.tsx' '*.mts' '*.cts')

base_ref=''
for candidate in "${LINT_BASE_REF:-}" origin/main main; do
  if [ -n "$candidate" ] && git rev-parse --verify --quiet "$candidate" >/dev/null 2>&1; then
    base_ref="$candidate"
    break
  fi
done

collect_files() {
  # Committed work on this branch, relative to where it forked from base.
  if [ -n "$base_ref" ]; then
    local merge_base
    merge_base="$(git merge-base "$base_ref" HEAD 2>/dev/null || true)"
    if [ -n "$merge_base" ]; then
      git diff --name-only -z --diff-filter=ACMR "$merge_base" -- "${PATTERNS[@]}"
    fi
  fi
  # Staged and unstaged edits.
  git diff --name-only -z --diff-filter=ACMR HEAD -- "${PATTERNS[@]}"
  # New files that are not committed yet but are not ignored either.
  git ls-files -z --others --exclude-standard -- "${PATTERNS[@]}"
}

files_list="$(collect_files | tr '\0' '\n' | grep -v '^$' | sort -u || true)"

if [ -z "$files_list" ]; then
  echo "lint-changed: no changed TypeScript files."
  exit 0
fi

# Build an argv array rather than piping to xargs, so eslint's own exit code
# survives (xargs reports its own 123 for any non-zero child).
files=()
while IFS= read -r file; do
  if [ -n "$file" ]; then files+=("$file"); fi
done <<< "$files_list"

echo "lint-changed: linting ${#files[@]} file(s)${base_ref:+ (base: ${base_ref})}"

exec eslint --fix --no-warn-ignored "${files[@]}"
