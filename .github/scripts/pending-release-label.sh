#!/usr/bin/env bash
#
# Label the open issues named by a Closes-on-release marker in a merged pull
# request, so they read as fixed and waiting on a release. release-comment.sh
# removes the label when the release closes them.
#
# Usage: pending-release-label.sh [<pr-number>]
#
# With no PR number, sweep every merged PR whose commits are on main or dev
# but in no stable release yet.
#
#   GH_TOKEN           token with issues write access
#   GITHUB_REPOSITORY  owner/name
#   DRY_RUN            "true" lists the issues without labeling

set -euo pipefail

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
DRY_RUN="${DRY_RUN:-false}"
LABEL="pending release"
LABEL_READY=false
FAILED=0

ensure_label() {
  if [ "${LABEL_READY}" = "true" ] || [ "${DRY_RUN}" = "true" ]; then
    return
  fi

  if ! gh api "repos/${REPO}/labels/${LABEL// /%20}" > /dev/null 2>&1; then
    gh api "repos/${REPO}/labels" \
      -f name="${LABEL}" \
      -f color=0e8a16 \
      -f description="Fix merged; closes when a stable release ships it" > /dev/null
  fi
  LABEL_READY=true
}

# Usage: label_pr <pr-number> [any-base]
#
# "any-base" skips the base branch check, for PRs already known to be
# headed for a release.
label_pr() {
  local pr="$1" any_base="${2:-}"
  local pr_json base text n issue state
  local -a numbers

  pr_json="$(gh api "repos/${REPO}/pulls/${pr}")"

  if [ "$(jq -r '.merged_at != null' <<< "${pr_json}")" != "true" ]; then
    echo "#${pr} is not merged."
    return
  fi

  # Only main and dev produce releases.
  base="$(jq -r '.base.ref' <<< "${pr_json}")"
  if [ -z "${any_base}" ] && [ "${base}" != "main" ] && [ "${base}" != "dev" ]; then
    echo "#${pr} merged into ${base}, which does not release."
    return
  fi

  # release-comment.sh reads the marker from PR bodies and commit messages.
  text="$(jq -r '.body // ""' <<< "${pr_json}")"
  text+=$'\n'"$(gh api --paginate "repos/${REPO}/pulls/${pr}/commits" --jq '.[].commit.message')"

  mapfile -t numbers < <(
    grep -iE '^[[:space:]]*closes-on-release:' <<< "${text}" \
      | grep -oE '#[0-9]+' | tr -d '#' | sort -un || true
  )
  echo "#${pr} closes on release: ${numbers[*]:-none}"

  for n in "${numbers[@]}"; do
    if ! issue="$(gh api "repos/${REPO}/issues/${n}")"; then
      echo "::warning::Could not read #${n}."
      FAILED=$((FAILED + 1))
      continue
    fi

    state="$(jq -r 'if .pull_request then "pr" else .state end' <<< "${issue}")"
    case "${state}" in
      pr)
        echo "  #${n}: is a pull request, not labeling"
        continue
        ;;
      closed)
        echo "  #${n}: already closed"
        continue
        ;;
    esac

    if [ "$(jq --arg l "${LABEL}" 'any(.labels[]; .name == $l)' <<< "${issue}")" = "true" ]; then
      echo "  #${n}: already labeled"
      continue
    fi

    if [ "${DRY_RUN}" = "true" ]; then
      echo "  #${n}: would label"
      continue
    fi

    ensure_label
    if gh api "repos/${REPO}/issues/${n}/labels" -f "labels[]=${LABEL}" > /dev/null; then
      echo "  #${n}: labeled"
    else
      echo "::warning::Could not label #${n}."
      FAILED=$((FAILED + 1))
    fi
  done
}

sweep() {
  local latest branch sha pr shas="" prs=""
  local -a sha_list pr_list

  latest="$(gh api "repos/${REPO}/releases/latest" --jq '.tag_name')"
  echo "Latest stable release: ${latest}"

  for branch in main dev; do
    shas+="$(gh api --paginate "repos/${REPO}/compare/${latest}...${branch}" --jq '.commits[].sha')"$'\n'
  done
  mapfile -t sha_list < <(sed '/^$/d' <<< "${shas}" | sort -u)
  echo "Unreleased commits: ${#sha_list[@]}"

  for sha in "${sha_list[@]}"; do
    prs+="$(gh api "repos/${REPO}/commits/${sha}/pulls" --jq '.[] | select(.merged_at != null) | .number')"$'\n'
  done
  mapfile -t pr_list < <(sed '/^$/d' <<< "${prs}" | sort -un)
  echo "Unreleased PRs: ${pr_list[*]:-none}"

  for pr in "${pr_list[@]}"; do
    label_pr "${pr}" any-base
  done
}

if [ -n "${1:-}" ]; then
  label_pr "$1"
else
  sweep
fi

if [ "${FAILED}" -gt 0 ]; then
  echo "${FAILED} item(s) failed." >&2
  exit 1
fi
