#!/usr/bin/env bash
#
# Print what a release announcement needs to know about a range of commits.
#
# Usage: gather-release.sh [--from <tag>] [--to <ref>]
#
#   --from  the previous stable release tag. Defaults to the newest vYYYY.M.P
#           tag reachable from --to, skipping prereleases.
#   --to    the release ref. Defaults to origin/main.
#
# Sections:
#   1. the range and the version it most likely ships as
#   2. commits grouped by conventional type, with breaking changes
#   3. draft posts already on --to
#   4. the ErsatzTV next pin at both ends, and upstream release notes for
#      every ErsatzTV/next release in between when the pin changed
#
# Run from anywhere inside the Tunarr repo. Needs git, jq and an
# authenticated gh.

set -euo pipefail

FROM=""
TO="origin/main"
ETV_REPO="ErsatzTV/next"

while [ $# -gt 0 ]; do
  case "$1" in
    --from) FROM="${2:?--from needs a tag}"; shift 2 ;;
    --to) TO="${2:?--to needs a ref}"; shift 2 ;;
    -h | --help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"
git fetch --quiet --tags origin

if [ -z "${FROM}" ]; then
  FROM="$(git describe --tags --abbrev=0 --match 'v[0-9]*' --exclude '*-*' "${TO}")"
fi

# True when version $1 sorts strictly after version $2.
ver_gt() {
  [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -1)" = "$1" ]
}

# CalVer guess. Same month as the last release bumps PATCH, otherwise PATCH 0.
next_version() {
  local last="${FROM#v}" this_month
  this_month="$(date -u +%Y.%-m)"
  if [ "${last%.*}" = "${this_month}" ]; then
    echo "${this_month}.$(( ${last##*.} + 1 ))"
  else
    echo "${this_month}.0"
  fi
}

etv_pin() {
  git show "$1:server/package.json" | jq -r '.ersatztvNext.releaseTag // "none"'
}

echo "## 1. Range"
echo
echo "from:            ${FROM}"
echo "to:              ${TO} ($(git rev-parse --short "${TO}"))"
echo "commits:         $(git rev-list --count "${FROM}..${TO}")"
echo "likely version:  $(next_version)   (CalVer guess; confirm before using it in the post)"
echo

echo "## 2. Commits"
echo
git log --no-merges --format='%h%x09%s' "${FROM}..${TO}" | awk -F'\t' '
  {
    subject = $2
    type = subject
    sub(/[(!:].*/, "", type)
    if (subject ~ /^[a-z]+(\([^)]*\))?!:/) breaking[++nb] = $1 "  " subject
    if (type == "feat") feat[++nf] = $1 "  " subject
    else if (type == "fix") fix[++nx] = $1 "  " subject
    else if (type == "perf") perf[++np] = $1 "  " subject
    else other[++no] = $1 "  " subject
  }
  function show(title, arr, n,   i) {
    print "### " title " (" n + 0 ")"
    for (i = 1; i <= n; i++) print arr[i]
    print ""
  }
  END {
    show("feat", feat, nf)
    show("fix", fix, nx)
    show("perf", perf, np)
    show("breaking (! in subject)", breaking, nb)
    show("other (usually skip: chore, ci, test, refactor, docs, build)", other, no)
  }
'

echo "### BREAKING CHANGE footers"
git log --no-merges --format='%h%x09%s' --grep='BREAKING CHANGE' "${FROM}..${TO}" || true
echo

echo "## 3. Draft posts on ${TO}"
echo
found=0
for post in $(git ls-tree -r --name-only "${TO}" docs/blog/posts | grep '/index\.md$'); do
  if git show "${TO}:${post}" | awk 'NR == 1 && $0 != "---" { exit } NR > 1 && $0 == "---" { exit } NR > 1 { print }' |
    grep -qE '^draft:[[:space:]]*true[[:space:]]*$'; then
    echo "${post}"
    found=1
  fi
done
[ "${found}" -eq 1 ] || echo "none"
echo

echo "## 4. ErsatzTV next"
echo
OLD_ETV="$(etv_pin "${FROM}")"
NEW_ETV="$(etv_pin "${TO}")"
echo "pinned at ${FROM}: ${OLD_ETV}"
echo "pinned at ${TO}: ${NEW_ETV}"
echo

if [ "${OLD_ETV}" = "${NEW_ETV}" ]; then
  echo "Unchanged. Leave ErsatzTV next out of the post unless a Tunarr commit changed its integration."
  exit 0
fi

if [ "${NEW_ETV}" = "none" ]; then
  echo "The pin was removed. Say so in the post."
  exit 0
fi

if [ "${OLD_ETV}" = "none" ]; then
  echo "First release to bundle ErsatzTV next. Introduce the backend; don't list upstream history."
  echo "Upstream notes for ${NEW_ETV} follow for reference."
  RANGE=("${NEW_ETV}")
elif ver_gt "${OLD_ETV#v}" "${NEW_ETV#v}"; then
  echo "The pin moved backward (downgrade). Say why in the post; check the PR that changed it."
  exit 0
else
  RANGE=()
  while read -r tag; do
    if ver_gt "${tag#v}" "${OLD_ETV#v}" && ! ver_gt "${tag#v}" "${NEW_ETV#v}"; then
      RANGE+=("${tag}")
    fi
  done < <(gh release list -R "${ETV_REPO}" --exclude-pre-releases --limit 100 \
    --json tagName -q '.[].tagName' | grep -E '^v[0-9]' | sort -V)
fi

echo "Upstream releases in (${OLD_ETV}, ${NEW_ETV}]: ${RANGE[*]}"
echo "Pin changed in: $(git log --format='%h %s' "${FROM}..${TO}" -- server/package.json |
  grep -i -E 'ersatz|etv' | tr '\n' ';' || true)"
echo

for tag in "${RANGE[@]}"; do
  echo "----- ${ETV_REPO} ${tag} -----"
  echo "https://github.com/${ETV_REPO}/releases/tag/${tag}"
  echo
  gh release view "${tag}" -R "${ETV_REPO}" --json body -q .body ||
    echo "(no release body; read CHANGELOG.md at ${tag} instead)"
  echo
done
