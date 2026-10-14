#!/usr/bin/env bash
#
# Build the working tree into a Docker image and run it, locally or on a
# remote Docker host, for testing a change on real hardware.
#
# Three compose files are layered, in this order:
#
#   docker/test/compose.yaml                     base, hardware-neutral
#   docker/test/pipelines/<name>.compose.yaml    hardware pipeline
#   docker/test/local.compose.yaml               this developer's host (optional)
#
# Settings come from docker/test/.env. The last two entries above and the .env
# file are what differ between machines; only the pipeline files are committed.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

dir=docker/test
env_file=$dir/.env
pipelines_dir=$dir/pipelines
local_file=$dir/local.compose.yaml

usage() {
  cat <<'USAGE'
Usage: docker-test [docker compose arguments]

  (no arguments)  build the working tree and start it: up -d --build
  logs -f         follow the container logs
  config          print the merged compose file without running anything
  down            stop and remove the container

Any other arguments are passed to `docker compose` unchanged.
Configure with docker/test/.env (see docker/test/.env.example).
USAGE
}

case "${1:-}" in
  -h | --help)
    usage
    exit 0
    ;;
esac

if [[ ! -f "$env_file" ]]; then
  echo "docker-test: $env_file not found." >&2
  echo "Copy $dir/.env.example to $env_file and edit it." >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$env_file"
set +a

if [[ -n "${TUNARR_TEST_DOCKER_CONTEXT:-}" ]]; then
  export DOCKER_CONTEXT="$TUNARR_TEST_DOCKER_CONTEXT"
fi

TUNARR_BUILD="$(git rev-parse --short HEAD)"
export TUNARR_BUILD

files=(-f "$dir/compose.yaml")

pipeline="${TUNARR_TEST_PIPELINE:-none}"
if [[ "$pipeline" != "none" ]]; then
  pipeline_file="$pipelines_dir/$pipeline.compose.yaml"
  if [[ ! -f "$pipeline_file" ]]; then
    echo "docker-test: unknown TUNARR_TEST_PIPELINE '$pipeline'." >&2
    echo "Available: none" >&2
    for f in "$pipelines_dir"/*.compose.yaml; do
      echo "           $(basename "$f" .compose.yaml)" >&2
    done
    exit 1
  fi
  files+=(-f "$pipeline_file")
fi

if [[ -f "$local_file" ]]; then
  files+=(-f "$local_file")
fi

if [[ $# -eq 0 ]]; then
  set -- up -d --build
fi

exec docker compose "${files[@]}" "$@"
