#!/usr/bin/env bash

SCRIPT_FOLDER=$(dirname "${BASH_SOURCE[0]}")
REPO_ROOT=$(realpath "$SCRIPT_FOLDER/..")
APP_NAME="$REPO_ROOT/Tunarr.app"
ENTITLEMENTS="$REPO_ROOT/macos/Tunarr/Tunarr/Tunarr.entitlements"
SIGNING_IDENTITY="040A9C3F4C8D3D983822CCB65959A6FDB9DACDCD"

codesign --force --verbose --timestamp --options=runtime --entitlements "$ENTITLEMENTS" --sign "$SIGNING_IDENTITY" --deep "$APP_NAME"