# Tunarr

![GitHub Repo stars](https://img.shields.io/github/stars/chrisbenincasa/tunarr?style=flat&logo=github&color=lightseagreen) ![Docker Pulls](https://img.shields.io/docker/pulls/chrisbenincasa/tunarr?style=flat&logo=docker&color=lightseagreen) ![Docker Image Version](https://img.shields.io/docker/v/chrisbenincasa/tunarr?sort=semver&arch=amd64&style=flat&logo=docker&color=lightseagreen)

Create and configure live TV channels from media on your Plex & Jellyfin servers.

Access your channels by adding the spoofed Tunarr HDHomerun tuner to Plex, Jellyfin, or Emby. Or utilize the m3u Url with any 3rd party IPTV player app.

<p align="center">
<img src="./design/tunarr-guide.png">
<img src="./design/tunarr-channels.png">
</p>

## Disclaimer

- ⚠️ Tunarr is under **very active** development.
- ⚠️ Expect bugs and breaking changes!

## What is this?

Tunarr is a rewrite / rebrand of [**dizqueTV**](https://github.com/vexorian/dizquetv) (which in itself was a fork of [other projects](https://github.com/DEFENDORe/pseudotv)!). This project was born out of both a love for TV and an appreciation for the work put into dizqueTV and its predecessors.

Tunarr has the following goals:

- Modernize the stack, both backend and frontend
- Provide an migration path for existing users
- Stabilize the program, fix bugs, and improve performance (Tunarr currently is developed and tested on Node 20.11.1, which offers [non-trivial performance improvements](https://blog.rafaelgss.dev/state-of-nodejs-performance-2023) over previous versions)
- Modernize and "prettify" the Web UI
- And of course, **Add a ton great new features!**

## Features

- **NEW** Jellyfin library support!
- **NEW** Stream your channels directly in the [browser using HLS](https://github.com/chrisbenincasa/tunarr/pull/116)
- **NEW** Complete rewrite of streaming pipeline, offering better stability and improved performance
- **NEW** [Dark mode!](https://github.com/chrisbenincasa/tunarr/pull/34)
- **NEW** Quickly find content you want for your channels with [advanced filtering and sorting](https://github.com/chrisbenincasa/tunarr/pull/210) (Jellyfin filtering [coming soon](https://github.com/chrisbenincasa/tunarr/issues/752))
- **NEW** Scheduled, configurable backups - never lose your channels and configuration!
- **NEW** Support multiple transcode configurations and set them per-channel
- **NEW** Improved UI for time/random slot scheduling
- Spoofed [HDHR](https://www.silicondust.com/hdhomerun/) tuner and a IPTV channel list, providing a large amount of flexibility and easing integration with [xTeVe](https://github.com/xteve-project/xTeVe) or [Threadfin](https://github.com/Threadfin/Threadfin) and Plex, or the IPTV client of your choice.
- Customize channels with a logo, filler content ("commercials", music videos, prerolls, channel branding videos) between programming, and more!
- View channel lineups on the web-based TV Guide
- Support for hardware accelerated transcoding, including Nvidia, VAAPI, QuickSync, and macOS VideoToolbox.
- ~~Subtitle support~~ Subtitle support is currently in flux; it was removed to simplify the backend and stabilize the stream. Bringing this functionality back is tracked in [#462](https://github.com/chrisbenincasa/tunarr/issues/462).

## Limitations

- If you want to play the TV channels in Plex using the spoofed HDHR, Plex Pass is required.
- Like dizqueTV, Tunarr does not currently watch your Plex server for media updates/changes. You must manually remove and re-add your programs for any changes to take effect. Same goes for Plex server changes (changing IP, port, etc).. You&apos;ll have to update the server settings manually in that case. **NOTE** This feature is actively under development! (https://github.com/chrisbenincasa/tunarr/issues/15)

## Releases

- https://github.com/chrisbenincasa/Tunarr/releases

## Wiki

- For setup instructions, check our [documentation site](https://tunarr.com/)

## Development

[pnpm](https://pnpm.io), [turbo](https://turbo.build/), and [vite](https://vitejs.dev/) are used for package management and development. More details on the development environment, setup, and contributing to come!

### Start dev servers

Run from the root of the project:

```
pnpm turbo dev
```

After the servers are running, the backend should be available at `localhost:8000` and the frontend at `localhost:5173/web`.

## License

- The original dizqueTV is released under zlib license (c) 2020 Victor Hugo Soliz Kuncar: we've kept this.
