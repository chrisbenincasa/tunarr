#!/usr/bin/env bash
# Create and notarize Tunarr.dmg using operator credentials.
# Prerequisites: Tunarr.app signed via sign-macos-local.sh
#
# Required env:
#   APPLE_SIGNING_IDENTITY  — for optional DMG codesign
#   NOTARY_APPLE_ID         — Apple ID email
#   NOTARY_APP_PASSWORD     — app-specific password
#   APPLE_TEAM_ID           — Team ID for notarytool
#
# Usage:
#   export TUNARR_VERSION=1.2.8-roto.1
#   scripts/notarize-macos-dmg.sh
set -euo pipefail

SCRIPT_FOLDER=$(dirname "${BASH_SOURCE[0]}")
REPO_ROOT=$(realpath "$SCRIPT_FOLDER/..")
DMG_NAME="${TUNARR_DMG_PATH:-$REPO_ROOT/Tunarr.dmg}"
APP_NAME="${TUNARR_APP_PATH:-$REPO_ROOT/Tunarr.app}"

NOTARY_APPLE_ID="${NOTARY_APPLE_ID:-${AC_USERNAME:-}}"
NOTARY_APP_PASSWORD="${NOTARY_APP_PASSWORD:-${AC_PASSWORD:-}}"
APPLE_TEAM_ID="${APPLE_TEAM_ID:-}"

for var in NOTARY_APPLE_ID NOTARY_APP_PASSWORD APPLE_TEAM_ID; do
  if [[ -z "${!var}" ]]; then
    echo "ERROR: $var is not set" >&2
    exit 2
  fi
done

if [[ ! -d "$APP_NAME" ]]; then
  echo "ERROR: $APP_NAME missing" >&2
  exit 1
fi

if ! command -v create-dmg >/dev/null 2>&1; then
  echo "ERROR: install create-dmg (brew install create-dmg)" >&2
  exit 1
fi

rm -f "$DMG_NAME"
create-dmg \
  --volname "Tunarr" \
  --volicon "$REPO_ROOT/design/Tunarr.icns" \
  --window-pos 200 120 \
  --window-size 800 400 \
  --icon-size 100 \
  --icon "Tunarr.app" 200 190 \
  --hide-extension "Tunarr.app" \
  --app-drop-link 600 185 \
  --skip-jenkins \
  --no-internet-enable \
  "$DMG_NAME" \
  "$APP_NAME/"

if [[ -n "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  codesign --force --timestamp --options=runtime --sign "$APPLE_SIGNING_IDENTITY" "$DMG_NAME"
fi

echo "Submitting $DMG_NAME for notarization..."
xcrun notarytool submit "$DMG_NAME" \
  --apple-id "$NOTARY_APPLE_ID" \
  --password "$NOTARY_APP_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

xcrun stapler staple "$DMG_NAME"
xcrun stapler validate "$DMG_NAME"
echo "[PASSED] notarization complete: $DMG_NAME"
