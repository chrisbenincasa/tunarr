#!/usr/bin/env bash
#
# Propose a PR that publishes the pending release post for a stable release.
#
# Usage: promote-release-post.sh <version>
#
#   GH_TOKEN           token with contents and pull-requests write access
#   GITHUB_REPOSITORY  owner/name
#   DRY_RUN            "true" prints the change without pushing or opening a PR
#   RELEASE_DATE       YYYY-MM-DD for the post's date. Defaults to today in UTC.
#
# A pending post is docs/blog/posts/<folder>/index.md with `draft: true` in its
# front matter. The PR renames the folder to the version, sets `date` and
# `slug`, and drops `draft`. Every release force-pushes the same branch, so at
# most one promotion PR is open and it always targets the newest release.
#
# The release already exists when this runs. Ambiguous drafts become workflow
# warnings, and any other failure leaves only the promotion to do by hand.

set -euo pipefail

VERSION="${1:?usage: promote-release-post.sh <version>}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
DRY_RUN="${DRY_RUN:-false}"
RELEASE_DATE="${RELEASE_DATE:-$(date -u +%Y-%m-%d)}"
BRANCH="release-post/promote"
POSTS="docs/blog/posts"

if [[ "${VERSION}" == *-* ]]; then
  echo "Skipping prerelease ${VERSION}."
  exit 0
fi

warn() {
  echo "::warning::$*"
  exit 0
}

# Prints the front matter of a Markdown file, without the --- fences.
front_matter() {
  awk 'NR == 1 && $0 != "---" { exit } NR > 1 && $0 == "---" { exit } NR > 1 { print }' "$1"
}

git fetch --quiet origin main
git checkout --quiet -B "${BRANCH}" origin/main

DRAFTS=()
for post in "${POSTS}"/*/index.md; do
  [ -f "${post}" ] || continue
  if front_matter "${post}" | grep -qE '^draft:[[:space:]]*true[[:space:]]*$'; then
    DRAFTS+=("${post}")
  fi
done

if [ "${#DRAFTS[@]}" -eq 0 ]; then
  echo "No pending release post."
  exit 0
fi
if [ "${#DRAFTS[@]}" -gt 1 ]; then
  warn "Found ${#DRAFTS[@]} draft release posts (${DRAFTS[*]}). Publish one by hand."
fi

SOURCE="$(dirname "${DRAFTS[0]}")"
TARGET="${POSTS}/${VERSION}"

if [ "${SOURCE}" != "${TARGET}" ]; then
  if [ -e "${TARGET}" ]; then
    warn "${TARGET} already exists, so ${SOURCE} cannot move there."
  fi
  git mv "${SOURCE}" "${TARGET}"
fi

# Rewrites only the front matter. Missing date or slug keys are added before
# the closing fence.
POST="${TARGET}/index.md"
awk -v date="${RELEASE_DATE}" -v slug="${VERSION}" '
  NR == 1 && $0 == "---" { in_fm = 1; print; next }
  in_fm && $0 == "---" {
    if (!seen_date) print "date: " date
    if (!seen_slug) print "slug: \"" slug "\""
    in_fm = 0; print; next
  }
  in_fm && /^draft:/ { next }
  in_fm && /^date:/ { print "date: " date; seen_date = 1; next }
  in_fm && /^slug:/ { print "slug: \"" slug "\""; seen_slug = 1; next }
  { print }
' "${POST}" > "${POST}.tmp"
mv "${POST}.tmp" "${POST}"
git add "${POST}"

git -c user.name="github-actions[bot]" \
  -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
  commit --quiet -m "docs(blog): publish the ${VERSION} release post"

git show --stat --format='%s' HEAD
git diff HEAD^ HEAD -- "${POST}"

if [ "${DRY_RUN}" = "true" ]; then
  echo "Dry run: would push ${BRANCH} and open or update its PR."
  exit 0
fi

git push --quiet --force origin "HEAD:refs/heads/${BRANCH}"

TITLE="docs(blog): publish the ${VERSION} release post"
BODY="$(cat <<EOF
The release workflow opened this PR after cutting [v${VERSION}](https://github.com/${REPO}/releases/tag/v${VERSION}). It publishes the pending release post as \`${TARGET}/\`.

- Renamed \`${SOURCE}/\` to \`${TARGET}/\`
- Set \`date: ${RELEASE_DATE}\` and \`slug: "${VERSION}"\`
- Removed \`draft: true\`

Merge it if the post describes this release. Close it if the post belongs to a later release, and the next release will propose it again.

The docs site deploys on merge, and \`docs.yml\` then adds the post link to the top of the release notes.

CI does not run on this PR, because GitHub starts no workflows for PRs opened by \`GITHUB_TOKEN\`.
EOF
)"

OWNER="${REPO%%/*}"
EXISTING="$(gh api "repos/${REPO}/pulls?head=${OWNER}:${BRANCH}&state=open" -q '.[0].number // empty')"

if [ -n "${EXISTING}" ]; then
  gh api -X PATCH "repos/${REPO}/pulls/${EXISTING}" -f title="${TITLE}" -f body="${BODY}" > /dev/null
  echo "Updated PR #${EXISTING}."
else
  NUMBER="$(gh api "repos/${REPO}/pulls" -f head="${BRANCH}" -f base=main \
    -f title="${TITLE}" -f body="${BODY}" -q .number)"
  echo "Opened PR #${NUMBER}."
fi
