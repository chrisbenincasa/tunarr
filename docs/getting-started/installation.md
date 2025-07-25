# Installation

Tunarr is available in two flavors: Docker image and standalone binaries.

## Docker

<a href="https://hub.docker.com/r/chrisbenincasa/tunarr"><img alt="Docker Pull Count" src="https://img.shields.io/docker/pulls/chrisbenincasa/tunarr" /></a>

Tunarr is available on [Docker Hub](https://hub.docker.com/r/chrisbenincasa/tunarr) as well as [GHCR](https://github.com/chrisbenincasa/tunarr/pkgs/container/tunarr). Docker images come pre-packaged with `ffmpeg` 7.1.1 (thanks [@jasongdove](https://github.com/jasongdove) from ErsatzTV!).

Since Tunarr is currently pre-release. There are a few tags to choose from which have different releae cadences:

- `x.x.x` (versioned): These are release cuts. Because we are pre-1.0.0, breaking changes cause major version bumps and bug fixes are patch version bumps. Once we achieve 1.0.0, we will use proper semver.
- `latest`: The latest tag points at the most recent release version.
- `edge`: Pushed every 2 hours off of the "dev" branch. This build can be unstable. **NOTE**: If switching from a versioned/latest build to an edge build, it's recommended to take a backup of your entire Tunarr data directory. Downgrading from "edge" to a previous version is not supported; edge builds can contain non-backwards compatible changes, like database schema changes.

[Docker Hub](https://hub.docker.com/r/chrisbenincasa/tunarr/):

- `chrisbenincasa/tunarr:latest`
- `chrisbenincasa/tunarr:edge`

[GHCR](https://github.com/chrisbenincasa/tunarr/pkgs/container/tunarr):

- `ghcr.io/chrisbenincasa/tunarr:latest`
- `ghcr.io/chrisbenincasa/tunarr:edge`

Currently ARM builds are published under separate tags. Take any of the tags above and append `-arm64` to get a Docker image for ARM-based hosts.

### Unraid

Tunarr is available in the [Community Apps](https://unraid.net/community/apps) store on Unraid. After [installing the Community Apps plugin](https://forums.unraid.net/topic/38582-plug-in-community-applications/) on your Unraid machine, simply search for "tunarr" and select the resulting app (provided by grtgbln's repository).

Follow the on-screen instructions to set up the container, including mapping the Web UI port. You can optionally pass in an Nvidia GPU or Intel iGPU for hardware transcoding (use the proper corresponding Docker tag; enable "Advanced View" for more details), and optionally map an existing dizqueTV configuration directory to migrate (click "Show more settings...").

## Binaries

Tunarr is released in pre-built binaries for Linux (x64/ARM), Windows (x64), and macOS (x64/ARM). Tunarr currently does not provide a version of FFmpeg along with these binaries, so you must have your own build ready to go. We recommend using the pre-built FFmpeg 7.1.1 binaries provided by [ErsatzTV](https://github.com/ErsatzTV/ErsatzTV-ffmpeg/releases/tag/7.1.1). If these don't work, builds from [BtbN/FFmpegBuilds](https://github.com/BtbN/FFmpeg-Builds) or [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) should _generally_ work as well. If you are planning on using hardware acceleration, ensure that the build of FFmpeg you use includes the proper libraries built-in.

Like Docker images, binaries are released with versions as well as a singular 'edge' build which is released bihourly.

* [Latest release](http://github.com/chrisbenincasa/tunarr/releases/latest)
* [Edge release](https://github.com/chrisbenincasa/tunarr/releases/tag/edge)
* [All releases](https://github.com/chrisbenincasa/tunarr/releases)
