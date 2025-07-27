#!/usr/bin/env bash

BINARY_NAME="$1"
SCRIPT_FOLDER=$(dirname "${BASH_SOURCE[0]}")
REPO_ROOT=$(realpath "$SCRIPT_FOLDER/..")
APP_NAME="$REPO_ROOT/Tunarr.app"

if [ -d "$APP_NAME" ]
then
    rm -rf "$APP_NAME"
fi

pushd "$REPO_ROOT/macos/Tunarr" || exit

xcodebuild build
cp -R "$REPO_ROOT/macos/Tunarr/build/Release/Tunarr.app" "$APP_NAME"

popd || exit

cp -a "$REPO_ROOT/server/bin/$BINARY_NAME" "$APP_NAME/Contents/MacOS/tunarr-macos"

chmod +x "$APP_NAME/Contents/MacOS/tunarr-macos"