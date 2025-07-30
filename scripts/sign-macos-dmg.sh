#! /bin/bash

#!/usr/bin/env bash

SCRIPT_FOLDER=$(dirname "${BASH_SOURCE[0]}")
REPO_ROOT=$(realpath "$SCRIPT_FOLDER/..")
DMG_NAME="$REPO_ROOT/Tunarr.dmg"
ENTITLEMENTS="$REPO_ROOT/macos/Tunarr/Tunarr/Tunarr.entitlements"
SIGNING_IDENTITY="040A9C3F4C8D3D983822CCB65959A6FDB9DACDCD"

codesign --force --timestamp --options=runtime --entitlements "$ENTITLEMENTS" --sign "$SIGNING_IDENTITY" "$DMG_NAME"