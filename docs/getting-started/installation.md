# Installation

Tunarr is available in two flavors: Docker image and standalone binaries.

## Docker

<a href="https://hub.docker.com/r/chrisbenincasa/tunarr"><img alt="Docker Pull Count" src="https://img.shields.io/docker/pulls/chrisbenincasa/tunarr" /></a>

Tunarr is available on [Docker Hub](https://hub.docker.com/r/chrisbenincasa/tunarr) as well as [GHCR](https://github.com/chrisbenincasa/tunarr/pkgs/container/tunarr). Docker images come pre-packaged with `ffmpeg` 7.0 (thanks [@jasongdove](https://github.com/jasongdove) from ErsatzTV!).

The general format of tags is: `{release}{-encoder}?`.

Since Tunarr is currently pre-release. There are a few tags to choose from which have different releae cadences:

- `x.x.x` (versioned): These are release cuts. Because we are pre-1.0.0, breaking changes cause major version bumps and bug fixes are patch version bumps. Once we achieve 1.0.0, we will use proper semver.
- `latest`: The latest tag points at the most recent release version.
- `edge`: Pushed every 2 hours off of the "dev" branch. This build can be unstable. **NOTE**: If switching from a versioned/latest build to an edge build, it's recommended to take a backup of your entire Tunarr data directory. Downgrading from "edge" to a previous version is not supported; edge builds can contain non-backwards compatible changes, like database schema changes.

Each tag can also use specialized image builds which include support for hardware-accelerated encoding with Nvidia, QSV, and VAAPI.

Image tags are in the form `TAG(-HWACCEL)?`. For example, with the `latest` tag:

[Docker](https://hub.docker.com/r/chrisbenincasa/tunarr/):

- `chrisbenincasa/tunarr:latest`
- `chrisbenincasa/tunarr:latest-nvidia`
- `chrisbenincasa/tunarr:latest-vaapi`

[GHCR](https://github.com/chrisbenincasa/tunarr/pkgs/container/tunarr):

- `ghcr.io/chrisbenincasa/tunarr:latest`
- `ghcr.io/chrisbenincasa/tunarr:latest-nvidia`
- `ghcr.io/chrisbenincasa/tunarr:latest-vaapi`

### Unraid

Tunarr is available in the [Community Apps](https://unraid.net/community/apps) store on Unraid. After [installing the Community Apps plugin](https://forums.unraid.net/topic/38582-plug-in-community-applications/) on your Unraid machine, simply search for "tunarr" and select the resulting app (provided by grtgbln's repository).

Follow the on-screen instructions to set up the container, including mapping the Web UI port. You can optionally pass in an Nvidia GPU or Intel iGPU for hardware transcoding (use the proper corresponding Docker tag; enable "Advanced View" for more details), and optionally map an existing dizqueTV configuration directory to migrate (click "Show more settings...").

## Binaries

Tunarr is released in pre-built binaries for Linux (x64/ARM), Windows (x64), and macOS (x64/ARM).

Like Docker images, binaries are released with versions as well as a singular 'edge' build which is released bihourly.

Prebuilt edge binaries can be found at [https://github.com/chrisbenincasa/tunarr/releases/tag/edge](https://github.com/chrisbenincasa/tunarr/releases/tag/edge)
