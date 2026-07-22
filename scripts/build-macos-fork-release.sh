#!/usr/bin/env bash
# Build signed + notarized Tunarr macOS DMG (operator fork).
# See scripts/release.local.env.example for required variables.
set -euo pipefail

SCRIPT_FOLDER=$(dirname "${BASH_SOURCE[0]}")
REPO_ROOT=$(realpath "$SCRIPT_FOLDER/..")
cd "$REPO_ROOT"

ENV_FILE="${TUNARR_RELEASE_ENV:-$REPO_ROOT/config/release.local.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

TUNARR_VERSION="${TUNARR_VERSION:-1.2.8-roto.1}"
ARCH="$(uname -m)"
if [[ "$ARCH" == "arm64" ]]; then
  TARGET="macos-arm64"
  XCODE_ARCH="arm64"
else
  TARGET="macos-x64"
  XCODE_ARCH="x86_64"
fi

echo "==> Tunarr fork build $TUNARR_VERSION ($TARGET)"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
corepack enable 2>/dev/null || true
pnpm install

cat > .env <<EOF
TUNARR_VERSION=$TUNARR_VERSION
TUNARR_FULL_VERSION=$TUNARR_VERSION
TUNARR_BUILD=$(git rev-parse --short HEAD)
NODE_ENV=production
TUNARR_BIND_ADDR=0.0.0.0
EOF
cp .env server/.env
cp .env web/.env

pnpm turbo bundle --filter=@tunarr/web
pnpm turbo make-bin -- --target "$TARGET"

BINARY="tunarr-$TUNARR_VERSION-$TARGET"
plutil -replace CFBundleShortVersionString -string "$TUNARR_VERSION" macos/Tunarr/Tunarr/Info.plist
plutil -replace CFBundleVersion -string "$TUNARR_VERSION" macos/Tunarr/Tunarr/Info.plist

scripts/bundle-macos.sh "$BINARY" "$XCODE_ARCH" "$TARGET"
scripts/sign-macos-local.sh
scripts/notarize-macos-dmg.sh

RELEASE_DMG="Tunarr-${TUNARR_VERSION}-${TARGET}.dmg"
mv Tunarr.dmg "$RELEASE_DMG"
echo "==> Release artifact: $REPO_ROOT/$RELEASE_DMG"
