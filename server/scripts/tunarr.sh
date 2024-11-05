#!/bin/bash

SCRIPTPATH=$(dirname "$(realpath "$0")")
cd $SCRIPTPATH
eval ./bin/node ./bundle.js "$@"
