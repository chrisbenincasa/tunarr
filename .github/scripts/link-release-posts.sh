#!/usr/bin/env bash
#
# Put each published release post's link at the top of its GitHub release.
#
# Usage: link-release-posts.sh
#
#   GH_TOKEN           token with contents write access
#   GITHUB_REPOSITORY  owner/name
#   DRY_RUN            "true" lists the releases without editing them
#
# A post is published when its front matter has no `draft: true`. Its slug is
# the version, so the release is v<slug>. Releases that already mention the
# link are left alone, so every docs deploy can run this.

set -euo pipefail

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
DRY_RUN="${DRY_RUN:-false}"
SITE="https://tunarr.com/blog"

front_matter() {
  awk 'NR == 1 && $0 != "---" { exit } NR > 1 && $0 == "---" { exit } NR > 1 { print }' "$1"
}

NOTES="$(mktemp)"
trap 'rm -f "${NOTES}"' EXIT

for post in docs/blog/posts/*/index.md; do
  [ -f "${post}" ] || continue
  FM="$(front_matter "${post}")"

  if grep -qE '^draft:[[:space:]]*true[[:space:]]*$' <<< "${FM}"; then
    continue
  fi

  SLUG="$(sed -nE 's/^slug:[[:space:]]*"?([^"]*)"?[[:space:]]*$/\1/p' <<< "${FM}")"
  if [ -z "${SLUG}" ]; then
    echo "::warning::${post} has no slug."
    continue
  fi

  TAG="v${SLUG}"
  URL="${SITE}/${SLUG}/"

  if ! BODY="$(gh release view "${TAG}" --repo "${REPO}" --json body -q .body 2>/dev/null)"; then
    echo "No release ${TAG} for ${post}."
    continue
  fi

  if grep -qF "${URL}" <<< "${BODY}"; then
    continue
  fi

  if [ "${DRY_RUN}" = "true" ]; then
    echo "Dry run: would link ${URL} from ${TAG}."
    continue
  fi

  printf 'Read the announcement: %s\n\n%s\n' "${URL}" "${BODY}" > "${NOTES}"
  gh release edit "${TAG}" --repo "${REPO}" --notes-file "${NOTES}" > /dev/null
  echo "Linked ${URL} from ${TAG}."
done
