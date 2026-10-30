FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

# Same ffmpeg build as the production image and shell.nix.
ARG FFMPEG_TAG=7.1.1
ARG FFMPEG_BUILD=ffmpeg-n7.1.1-56-gc2184b65d2

RUN <<SH
set -eu
apt-get update
apt-get install -y --no-install-recommends sqlite3 xz-utils
rm -rf /var/lib/apt/lists/*

case "$(dpkg --print-architecture)" in
  amd64) target=linux64 ;;
  arm64) target=linuxarm64 ;;
  *) echo "unsupported architecture" >&2; exit 1 ;;
esac

dir="${FFMPEG_BUILD}-${target}-gpl-7.1"
curl -fsSL "https://github.com/ErsatzTV/ErsatzTV-ffmpeg/releases/download/${FFMPEG_TAG}/${dir}.tar.xz" \
  | tar -xJ -C /tmp
install -m 0755 "/tmp/${dir}/bin/ffmpeg" "/tmp/${dir}/bin/ffprobe" /usr/local/bin/

# The server defaults to /usr/bin paths.
ln -s /usr/local/bin/ffmpeg /usr/bin/ffmpeg
ln -s /usr/local/bin/ffprobe /usr/bin/ffprobe
rm -rf "/tmp/${dir}"
SH

# The base image ships its own pnpm. Corepack replaces it with the version
# pinned in package.json.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN npm uninstall -g pnpm && corepack enable pnpm
