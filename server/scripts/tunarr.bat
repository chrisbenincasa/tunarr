setlocal enabledelayedexpansion
set relativePath=./bundle.js

set absolutePath=%~dp0%relativePath%
"%~dp0/node-v22.13.0-win-x64/node.exe" "!absolutePath!" %*