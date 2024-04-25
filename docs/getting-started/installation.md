# Installation

Tunarr is available in two flavors: Docker image and standalone binaries.

## Docker

<a href="https://hub.docker.com/r/chrisbenincasa/tunarr"><img alt="Docker Pull Count" src="https://img.shields.io/docker/pulls/chrisbenincasa/tunarr" /></a>

Tunarr is available on [Docker Hub](https://hub.docker.com/r/chrisbenincasa/tunarr) as well as [GHCR](https://github.com/chrisbenincasa/tunarr/pkgs/container/tunarr). Docker images come pre-packaged with `ffmpeg` 7.0 (thanks [@jasongdove](https://github.com/jasongdove) from ErsatzTV!).

The general format of tags is: `{release}{-encoder}?`.

Since Tunarr is currently pre-release, there is a single tag: `edge`. The edge tag is pushed hourly from the `main` branch. We also support a specialized image builds which include support for hardware-accelerated encoding with Nvidia, QSV, and VAAPI.

!!! info

    Tunarr has experimental support for QSV / VAAPI. This issue is tracked here: [chrisbenincasa/tunarr#23](https://github.com/chrisbenincasa/tunarr/issues/23)

Docker:

- `chrisbenincasa/tunarr:edge`
- `chrisbenincasa/tunarr:edge-nvidia`
- `chrisbenincasa/tunarr:edge-vaapi`

GHCR:

- `ghcr.io/chrisbenincasa/tunarr:edge`
- `ghcr.io/chrisbenincasa/tunarr:edge-nvidia`
- `ghcr.io/chrisbenincasa/tunarr:edge-vaapi`

## Binaries

Tunarr is released in pre-built binaries for Windows (x64), macOS (x64), and Linux (x64).

Like Docker images, we currently have a single release, `edge` that updates hourly.

Prebuilt binaries can be found at [https://github.com/chrisbenincasa/tunarr/releases/tag/edge](https://github.com/chrisbenincasa/tunarr/releases/tag/edge)
