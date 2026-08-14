#!/usr/bin/env bash

SCRIPT_FOLDER=$(dirname "${BASH_SOURCE[0]}")
REPO_ROOT=$(realpath "$SCRIPT_FOLDER/..")
APP_NAME="$REPO_ROOT/Tunarr.app"
ENTITLEMENTS="$REPO_ROOT/macos/Tunarr/Tunarr/Tunarr.entitlements"
SIGNING_IDENTITY="1A20B3CA9E5870DBEC4746BCA413E0D391BD93B3"

security find-identity -p codesigning -v

codesign --force --verbose --timestamp --options=runtime --entitlements "$ENTITLEMENTS" --sign "$SIGNING_IDENTITY" --deep "$APP_NAME"
