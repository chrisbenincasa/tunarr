#!/usr/bin/env bash

docker build -f ./docker/docs.Dockerfile -t chrisbenincasa/tunarr-docs .

docker run --rm -it -p 8088:8000 -v "${PWD}":/docs chrisbenincasa/tunarr-docs