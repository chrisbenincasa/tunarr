#!/bin/sh

SCRIPTPATH=$(dirname "$(realpath "$0")")
cd $SCRIPTPATH
shift
eval ./bin/node ./bundle.js "$@"
