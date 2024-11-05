setlocal enabledelayedexpansion
set relativePath=./bundle.js

set absolutePath=%~dp0%relativePath%
"%~dp0/node-v20.15.1-win-x64/node.exe" "!absolutePath!" %*