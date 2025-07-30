#! /bin/bash

#!/usr/bin/env bash

SCRIPT_FOLDER=$(dirname "${BASH_SOURCE[0]}")
REPO_ROOT=$(realpath "$SCRIPT_FOLDER/..")
DMG_NAME="$REPO_ROOT/Tunarr.dmg"
ENTITLEMENTS="$REPO_ROOT/macos/Tunarr/Tunarr/Tunarr.entitlements"
SIGNING_IDENTITY="21F2F5C1AA7E5C352B6EC52AC9BFD58C0AC4B306"

security find-identity -p codesigning -v

codesign --force --timestamp --options=runtime --entitlements "$ENTITLEMENTS" --sign "$SIGNING_IDENTITY" "$DMG_NAME"
