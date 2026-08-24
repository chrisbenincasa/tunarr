#!/usr/bin/env bash
#
# Run every gate CI runs, in one command, before pushing.
#
# CI is spread over three workflows and no single local command covers them, so
# it is easy to run `turbo build`, see green, and still fail the PR. The gates
# and where they live:
#
#   main.yml        turbo typecheck --filter=@tunarr/server
#                   turbo build --filter=@tunarr/web
#                   turbo test -- run
#   lingui-pr.yml   lingui extract, then `git diff --exit-code web/src/locales/`
#   commitlint.yml  conventional-commit check on every commit in the PR
#
# eslint is deliberately included even though CI never runs it: it is enforced
# only by the pre-commit hook, so a commit made with the hook bypassed reaches
# the PR unlinted.
#
# The lingui gate mutates the working tree -- regenerating the catalogs is also
# the remedy, so leaving the result applied saves a round trip. If it reports a
# diff, commit web/src/locales/ and the gate passes.
#
# GATE ORDER MATTERS. The lingui catalogs record source line numbers -- and,
# for messages with complex placeholders, the whole surrounding file. So
# anything that rewrites source has to run BEFORE the extraction, and lingui
# runs last. Extracting first produces catalogs describing source that is then
# changed: green here, red in CI. Not hypothetical -- it happened twice while
# this script was being written.
#
# The subtle half is that the pre-commit hook is itself a rewriter. It runs
# `prettier --write` and `eslint --fix` on staged files at commit time, which is
# after any preflight can possibly run. So the format gate below applies the
# same prettier pass the hook will, leaving the tree in the shape the hook would
# produce. Without it the hook reformats at commit time and silently invalidates
# catalogs this script just certified.
set -uo pipefail

cd "$(git rev-parse --show-toplevel)"

usage() {
  cat <<'USAGE'
Usage: preflight [--quick]

  (default)  run every gate CI runs, plus eslint
  --quick    skip the web bundle and the test suite (the two slow gates);
             typecheck, lingui and lint still run
USAGE
}

quick=0
for arg in "$@"; do
  case "$arg" in
    --quick) quick=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "preflight: unknown argument '$arg'" >&2; usage >&2; exit 2 ;;
  esac
done

names=()
results=()
failed=0

record() {
  names+=("$1")
  results+=("$2")
  if [ "$2" != "pass" ]; then failed=1; fi
}

run_gate() {
  local name="$1"; shift
  printf '\n\033[1m==> %s\033[0m\n' "$name"
  if "$@"; then
    record "$name" pass
  else
    record "$name" FAIL
  fi
}

skip_gate() {
  names+=("$1")
  results+=("skipped")
}

# commitlint reads the range CI would read: this branch since it forked from the
# base. With no commits yet there is nothing to check, which is a pass.
gate_commitlint() {
  local base merge_base candidate
  for candidate in "${PREFLIGHT_BASE_REF:-}" origin/main main; do
    if [ -n "$candidate" ] && git rev-parse --verify --quiet "$candidate" >/dev/null 2>&1; then
      base="$candidate"
      break
    fi
  done
  if [ -z "${base:-}" ]; then
    echo "preflight: no base ref found, skipping commitlint"
    return 0
  fi
  merge_base="$(git merge-base "$base" HEAD 2>/dev/null)" || return 0
  if [ "$merge_base" = "$(git rev-parse HEAD)" ]; then
    echo "preflight: no commits since $base, nothing to lint"
    return 0
  fi
  pnpm exec commitlint --from "$merge_base" --to HEAD
}

# Mirrors what the pre-commit hook's lint-staged config does to staged files:
# `prettier --write` then `eslint --fix`. Applying prettier here keeps the hook
# from reformatting at commit time, after the lingui gate has already run.
gate_format() {
  local files
  files="$(collect_changed_source)"
  if [ -z "$files" ]; then
    echo "preflight: no changed TypeScript files to format"
    return 0
  fi
  # shellcheck disable=SC2086
  printf '%s\n' "$files" | tr '\n' '\0' | xargs -0 --no-run-if-empty pnpm exec prettier --write --log-level warn
}

collect_changed_source() {
  {
    git diff --name-only --diff-filter=ACMR HEAD -- '*.ts' '*.tsx' '*.mts' '*.cts'
    git ls-files --others --exclude-standard -- '*.ts' '*.tsx' '*.mts' '*.cts'
  } | grep -v '^$' | sort -u
}

# Mirrors lingui-pr.yml. Extraction rewrites the catalogs in place; a non-empty
# diff afterwards is exactly what CI fails on.
gate_lingui() {
  (cd web && pnpm run extract-messages) || return 1
  if git diff --quiet -- web/src/locales/; then
    return 0
  fi
  echo
  echo "preflight: catalogs are out of date and have been regenerated in place."
  echo "preflight: commit them to satisfy the lingui check:"
  git diff --name-only -- web/src/locales/ | sed 's/^/  /'
  echo "  git add web/src/locales && git commit -m 'chore(web): refresh lingui catalogs'"
  return 1
}

# First: everything that rewrites source, in the same order the pre-commit hook
# applies it, so the tree ends up where the hook would leave it.
run_gate "format (changed)"    gate_format
run_gate "eslint (changed)"    pnpm lint-changed

run_gate "commitlint"          gate_commitlint
run_gate "typecheck (server)"  pnpm turbo typecheck --filter=@tunarr/server

if [ "$quick" -eq 1 ]; then
  skip_gate "build (web)"
  skip_gate "test"
else
  run_gate "build (web)" pnpm turbo build --filter=@tunarr/web
  run_gate "test"        pnpm turbo test -- run
fi

# Last: derived from whatever source the gates above settled on.
run_gate "lingui catalogs"     gate_lingui

printf '\n\033[1m==> preflight summary\033[0m\n'
for i in "${!names[@]}"; do
  case "${results[$i]}" in
    pass)    printf '  \033[32m%-8s\033[0m %s\n' "pass" "${names[$i]}" ;;
    FAIL)    printf '  \033[31m%-8s\033[0m %s\n' "FAIL" "${names[$i]}" ;;
    *)       printf '  %-8s %s\n' "${results[$i]}" "${names[$i]}" ;;
  esac
done

if [ "$failed" -ne 0 ]; then
  echo
  echo "preflight: not ready to push."
  exit 1
fi

if [ "$quick" -eq 1 ]; then
  echo
  echo "preflight: passed, but --quick skipped the web bundle and the tests."
fi
