#!/usr/bin/env bash
#
# Label the open issues named by a Closes-on-release marker in a merged pull
# request, so they read as fixed and waiting on a release. release-comment.sh
# removes the label when the release closes them.
#
# Usage: pending-release-label.sh <pr-number>
#
#   GH_TOKEN           token with issues write access
#   GITHUB_REPOSITORY  owner/name
#   DRY_RUN            "true" lists the issues without labeling

set -euo pipefail

PR="${1:?usage: pending-release-label.sh <pr-number>}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
DRY_RUN="${DRY_RUN:-false}"
LABEL="pending release"

PR_JSON="$(gh api "repos/${REPO}/pulls/${PR}")"

if [ "$(jq -r '.merged_at != null' <<< "${PR_JSON}")" != "true" ]; then
  echo "#${PR} is not merged."
  exit 0
fi

# Only main and dev produce releases.
BASE="$(jq -r '.base.ref' <<< "${PR_JSON}")"
case "${BASE}" in
  main | dev) ;;
  *)
    echo "#${PR} merged into ${BASE}, which does not release."
    exit 0
    ;;
esac

# release-comment.sh reads the marker from PR bodies and commit messages.
TEXT="$(jq -r '.body // ""' <<< "${PR_JSON}")"
TEXT+=$'\n'"$(gh api --paginate "repos/${REPO}/pulls/${PR}/commits" --jq '.[].commit.message')"

mapfile -t NUMBERS < <(
  grep -iE '^[[:space:]]*closes-on-release:' <<< "${TEXT}" \
    | grep -oE '#[0-9]+' | tr -d '#' | sort -un || true
)
echo "#${PR} closes on release: ${NUMBERS[*]:-none}"

if [ "${#NUMBERS[@]}" -eq 0 ]; then
  exit 0
fi

if [ "${DRY_RUN}" != "true" ] && ! gh api "repos/${REPO}/labels/${LABEL// /%20}" > /dev/null 2>&1; then
  gh api "repos/${REPO}/labels" \
    -f name="${LABEL}" \
    -f color=0e8a16 \
    -f description="Fix merged; closes when a stable release ships it" > /dev/null
fi

FAILED=0

for n in "${NUMBERS[@]}"; do
  if ! ISSUE="$(gh api "repos/${REPO}/issues/${n}")"; then
    echo "::warning::Could not read #${n}."
    FAILED=$((FAILED + 1))
    continue
  fi

  STATE="$(jq -r 'if .pull_request then "pr" else .state end' <<< "${ISSUE}")"
  case "${STATE}" in
    pr)
      echo "#${n}: is a pull request, not labeling"
      continue
      ;;
    closed)
      echo "#${n}: already closed"
      continue
      ;;
  esac

  if [ "$(jq --arg l "${LABEL}" 'any(.labels[]; .name == $l)' <<< "${ISSUE}")" = "true" ]; then
    echo "#${n}: already labeled"
    continue
  fi

  if [ "${DRY_RUN}" = "true" ]; then
    echo "#${n}: would label"
    continue
  fi

  if gh api "repos/${REPO}/issues/${n}/labels" -f "labels[]=${LABEL}" > /dev/null; then
    echo "#${n}: labeled"
  else
    echo "::warning::Could not label #${n}."
    FAILED=$((FAILED + 1))
  fi
done

if [ "${FAILED}" -gt 0 ]; then
  echo "${FAILED} item(s) failed." >&2
  exit 1
fi
