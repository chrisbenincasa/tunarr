FROM mcr.microsoft.com/windows/nanoserver:ltsc2022 as base

# installs Chocolatey (Windows Package Manager)
RUN Set-ExecutionPolicy Bypass -Scope Process -Force;
RUN [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072;
RUN iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'));

# download and install Node.js
RUN choco install nodejs --version="20.12.0"

# verifies the right Node.js version is in the environment
RUN node -v

# verifies the right NPM version is in the environment
RUN npm -v