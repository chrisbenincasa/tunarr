#!/usr/bin/env bash

# Usage: post-create.sh <testing|review>

set -euo pipefail

profile="${1:?usage: post-create.sh <testing|review>}"

pnpm install --frozen-lockfile
pnpm turbo build --filter=@tunarr/types --filter=@tunarr/shared --output-logs=errors-only
(cd server && pnpm install-meilisearch)

if [[ "$profile" == "testing" ]]; then
  (cd e2e && pnpm exec playwright install --with-deps chromium)
fi
