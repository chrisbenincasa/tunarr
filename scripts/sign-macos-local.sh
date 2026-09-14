#!/usr/bin/env bash
# Sign Tunarr.app using operator-provided Developer ID identity.
# Usage:
#   export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
#   export APPLE_TEAM_ID="TEAMID"   # optional, for notarization
#   scripts/sign-macos-local.sh
set -euo pipefail

SCRIPT_FOLDER=$(dirname "${BASH_SOURCE[0]}")
REPO_ROOT=$(realpath "$SCRIPT_FOLDER/..")
APP_NAME="${TUNARR_APP_PATH:-$REPO_ROOT/Tunarr.app}"
ENTITLEMENTS="$REPO_ROOT/macos/Tunarr/Tunarr/Tunarr.entitlements"

if [[ ! -d "$APP_NAME" ]]; then
  echo "ERROR: $APP_NAME not found. Run bundle-macos.sh first." >&2
  exit 1
fi

SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-}"
if [[ -z "$SIGNING_IDENTITY" ]]; then
  echo "ERROR: Set APPLE_SIGNING_IDENTITY (e.g. \"Developer ID Application: Name (TEAMID)\")" >&2
  security find-identity -p codesigning -v | head -10
  exit 2
fi

echo "Signing with identity: $SIGNING_IDENTITY"
codesign --force --verbose --timestamp --options=runtime \
  --entitlements "$ENTITLEMENTS" \
  --sign "$SIGNING_IDENTITY" \
  --deep "$APP_NAME"

codesign --verify --deep --strict --verbose=2 "$APP_NAME"
echo "[PASSED] codesign verify"
