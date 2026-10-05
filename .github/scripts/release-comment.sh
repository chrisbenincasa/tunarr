#!/usr/bin/env bash
#
# Comment on every pull request and issue that shipped in a stable release.
#
# Usage: release-comment.sh <tag>
#
#   GH_TOKEN           token with issues and pull-requests write access
#   GITHUB_REPOSITORY  owner/name
#   DRY_RUN            "true" lists the targets without posting
#
# The range starts at the previous stable tag, so work merged to dev is
# announced once, when it reaches a stable release.

set -euo pipefail

TAG="${1:?usage: release-comment.sh <tag>}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
DRY_RUN="${DRY_RUN:-false}"

if [[ "${TAG}" == *-* ]]; then
  echo "Skipping prerelease ${TAG}."
  exit 0
fi

PREV_TAG="$(git describe --tags --abbrev=0 --match 'v[0-9]*' --exclude 'v*-*' "${TAG}^" 2>/dev/null || true)"
if [ -z "${PREV_TAG}" ]; then
  echo "No stable tag precedes ${TAG}." >&2
  exit 1
fi

mapfile -t SHAS < <(git rev-list "${PREV_TAG}..${TAG}")
echo "Range ${PREV_TAG}..${TAG}: ${#SHAS[@]} commits"

TARGETS="$(mktemp)"
trap 'rm -f "${TARGETS}"' EXIT

# Closing keywords in commit messages. The PR lookup below misses these when
# the PR body does not repeat them.
git log --format=%B "${PREV_TAG}..${TAG}" \
  | grep -oiE '\b(close[sd]?|fix(e[sd])?|resolve[sd]?):? +#[0-9]+' \
  | grep -oE '[0-9]+$' >> "${TARGETS}" || true

# Merged PRs containing each commit, plus the issues those PRs close.
for ((i = 0; i < ${#SHAS[@]}; i += 50)); do
  FIELDS=""
  for sha in "${SHAS[@]:i:50}"; do
    FIELDS+="c${sha}: object(oid: \"${sha}\") { ... on Commit { associatedPullRequests(first: 5) { nodes { number mergedAt closingIssuesReferences(first: 25) { nodes { number } } } } } } "
  done

  gh api graphql \
    -f owner="${REPO%/*}" \
    -f name="${REPO#*/}" \
    -f query="query(\$owner: String!, \$name: String!) { repository(owner: \$owner, name: \$name) { ${FIELDS} } }" \
    --jq '.data.repository[] | select(. != null) | .associatedPullRequests.nodes[]
          | select(.mergedAt != null) | .number, .closingIssuesReferences.nodes[].number' \
    >> "${TARGETS}"
done

mapfile -t NUMBERS < <(sort -un "${TARGETS}")
echo "Targets: ${NUMBERS[*]:-none}"

MARKER="<!-- release-comment:${TAG} -->"
BODY="$(printf 'This is included in [%s](https://github.com/%s/releases/tag/%s).\n\n%s' \
  "${TAG}" "${REPO}" "${TAG}" "${MARKER}")"
FAILED=0

for n in "${NUMBERS[@]}"; do

  # The marker makes reruns safe.
  if ! BODIES="$(gh api --paginate "repos/${REPO}/issues/${n}/comments" --jq '.[].body')"; then
    echo "::warning::Could not read comments on #${n}."
    FAILED=$((FAILED + 1))
    continue
  fi

  if grep -qF "${MARKER}" <<< "${BODIES}"; then
    echo "#${n}: already commented"
    continue
  fi

  if [ "${DRY_RUN}" = "true" ]; then
    echo "#${n}: would comment"
    continue
  fi

  if gh api "repos/${REPO}/issues/${n}/comments" -f body="${BODY}" > /dev/null; then
    echo "#${n}: commented"
  else
    echo "::warning::Could not comment on #${n}."
    FAILED=$((FAILED + 1))
  fi

  # GitHub's secondary rate limit penalises bursts of content creation.
  sleep 1
done

if [ "${FAILED}" -gt 0 ]; then
  echo "${FAILED} item(s) failed." >&2
  exit 1
fi
