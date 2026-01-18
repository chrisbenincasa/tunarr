#!/usr/bin/env bash

pnpm run generate-docs-script

docker build -f ./docker/docs.Dockerfile -t chrisbenincasa/tunarr-docs .

docker run --rm -it -p 8088:8000 -v "${PWD}":/docs chrisbenincasa/tunarr-docs