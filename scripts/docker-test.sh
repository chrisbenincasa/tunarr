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
  repro [options] run the stream-repro skill inside a throwaway container
                  built from the same image; options go to repro.mjs

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

# Runs .claude/skills/stream-repro/scripts/repro.mjs in a one-off container
# from the test image, so the repro's own server gets this pipeline's GPU and
# shares a filesystem with the script. The live tunarr-test container and its
# data directory are not touched. The output is copied back to a local temp
# directory.
repro_container=
run_repro() {
  local script=.claude/skills/stream-repro/scripts/repro.mjs
  local arg has_hwaccel=0
  for arg in "$@"; do
    case "$arg" in
      --out | --out=* | --keep-server | --keep-server=*)
        echo "docker-test: repro does not support $arg; the output is copied to a local temp directory and the server stops with the run." >&2
        exit 1
        ;;
      --hwaccel | --hwaccel=*) has_hwaccel=1 ;;
    esac
  done

  # Default the repro's transcode config to the pipeline the container has.
  local hwaccel=()
  if [[ $has_hwaccel -eq 0 ]]; then
    case "$pipeline" in
      vaapi | qsv) hwaccel=(--hwaccel "$pipeline") ;;
      nvidia) hwaccel=(--hwaccel cuda) ;;
    esac
  fi

  docker compose "${files[@]}" build tunarr

  repro_container="tunarr-repro-$$"
  trap 'docker rm -f "$repro_container" >/dev/null 2>&1 || true' EXIT
  docker compose "${files[@]}" run -d --no-deps --name "$repro_container" \
    --entrypoint sleep tunarr infinity >/dev/null
  docker cp "$script" "$repro_container:/tmp/repro.mjs"

  local status=0 interrupted=0
  # On Ctrl-C, `docker exec` can exit 0, so record the interrupt ourselves and
  # still copy out whatever the run produced.
  trap 'interrupted=1' INT TERM
  # ${hwaccel[@]+...} keeps an empty array from tripping `set -u` in bash 3.2.
  docker exec "$repro_container" node /tmp/repro.mjs \
    --server-bin /tunarr/tunarr --out /tmp/repro \
    ${hwaccel[@]+"${hwaccel[@]}"} "$@" || status=$?
  trap - INT TERM

  # Copy the output back even after a failed run; the report says why.
  local tmp="${TMPDIR:-/tmp}" out_dir
  out_dir="$(mktemp -d "${tmp%/}/tunarr-repro.XXXXXX")"
  if ! docker cp "$repro_container:/tmp/repro/." "$out_dir" >/dev/null; then
    echo "docker-test: could not copy the repro output out of the container." >&2
  fi

  # repro.mjs writes report.json only when it finishes.
  if [[ -f "$out_dir/report.json" ]]; then
    echo "docker-test: report: $out_dir/report.json"
  else
    echo "docker-test: no report.json; the run did not finish. Partial output: $out_dir" >&2
    [[ $status -eq 0 ]] && status=1
  fi
  [[ $interrupted -eq 1 ]] && status=130
  exit "$status"
}

if [[ "${1:-}" == "repro" ]]; then
  shift
  run_repro "$@"
fi

if [[ $# -eq 0 ]]; then
  set -- up -d --build
fi

exec docker compose "${files[@]}" "$@"
