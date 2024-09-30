#!/bin/bash

SCRIPTPATH=$(dirname "$(realpath "$0")")
cd $SCRIPTPATH

if [[ $# -gt 0 ]]; then
    shift;
fi

eval ./bin/node ./bundle.js "$@"
