#!/usr/bin/env bash
set -euo pipefail

SCRIPT_FOLDER=$(dirname "${BASH_SOURCE[0]}")
REPO_ROOT=$(realpath "$SCRIPT_FOLDER/..")
APP_NAME="$REPO_ROOT/Tunarr.app"
ENTITLEMENTS="$REPO_ROOT/macos/Tunarr/Tunarr/Tunarr.entitlements"
SIGNING_IDENTITY="21F2F5C1AA7E5C352B6EC52AC9BFD58C0AC4B306"

security find-identity -p codesigning -v

# Notarization requires a "Developer ID Application" certificate. An "Apple
# Development" cert is unexpired and passes `find-identity -v`, but the notary
# service rejects anything signed with it (status: Invalid). Fail here with a
# clear message instead of after a multi-minute notarization round-trip.
if ! security find-identity -p codesigning -v \
  | grep -q "$SIGNING_IDENTITY.*Developer ID Application"; then
  echo "ERROR: $SIGNING_IDENTITY is not an available 'Developer ID Application' identity." >&2
  echo "The APPLE_CERTIFICATE_P12_BASE64 secret must contain the Developer ID" >&2
  echo "Application cert and its private key, not an Apple Development cert." >&2
  exit 1
fi

codesign --force --verbose --timestamp --options=runtime --entitlements "$ENTITLEMENTS" --sign "$SIGNING_IDENTITY" --deep "$APP_NAME"

# Confirm the signature that actually landed is Developer ID with a hardened
# runtime before we hand the bundle to the notary service. `spctl --assess` is
# not usable here: it rejects a correctly signed app until it has been
# notarized and stapled, which has not happened yet at this point.
codesign --verify --strict --deep --verbose=2 "$APP_NAME"

signature_info=$(codesign --display --verbose=4 "$APP_NAME" 2>&1)
echo "$signature_info"

if ! grep -q "^Authority=Developer ID Application" <<<"$signature_info"; then
  echo "ERROR: $APP_NAME was not signed by a Developer ID Application authority." >&2
  exit 1
fi

# The notary service rejects submissions that are not signed with the hardened
# runtime enabled (--options=runtime).
if ! grep -qE "^CodeDirectory .*flags=0x[0-9a-f]+\([^)]*runtime" <<<"$signature_info"; then
  echo "ERROR: $APP_NAME is not signed with the hardened runtime enabled." >&2
  exit 1
fi
