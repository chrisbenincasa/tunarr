#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 1.2.0"
    exit 1
fi

VERSION="$1"

# Validate version format (basic semver check)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
    echo "Error: Invalid version format. Expected semver (e.g., 1.2.0 or 1.2.0-beta.1)"
    exit 1
fi

# Check for jq
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed."
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Package.json files to update (relative to root)
PACKAGE_FILES=(
    "package.json"
    "server/package.json"
    "shared/package.json"
    "types/package.json"
    "web/package.json"
)

echo "Updating version to $VERSION in all package.json files..."

for file in "${PACKAGE_FILES[@]}"; do
    filepath="$ROOT_DIR/$file"
    if [[ -f "$filepath" ]]; then
        tmp=$(mktemp)
        jq --arg version "$VERSION" '.version = $version' "$filepath" > "$tmp"
        mv "$tmp" "$filepath"
        echo "  Updated $file"
    else
        echo "  Warning: $file not found, skipping"
    fi
done

echo ""
echo "Committing changes..."

cd "$ROOT_DIR"
git add "${PACKAGE_FILES[@]}"
git commit -m "chore: bump version to $VERSION"

echo ""
echo "Done! Version bumped to $VERSION and committed."
