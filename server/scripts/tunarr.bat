setlocal enabledelayedexpansion
set relativePath=./bundle.js

set absolutePath=%~dp0%relativePath%
echo %absolutePath%
"./node-v20.15.1-win-x64/node.exe" "!absolutePath!"