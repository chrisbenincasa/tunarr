# Tunarr

Create live TV channels from media on your Plex servers, and more!

Configure your channels, programs, commercials, and settings using the Tunarr web UI.

Access your channels by adding the spoofed Tunarr HDHomerun tuner to Plex, Jellyfin, or Emby. Or utilize the m3u Url with any 3rd party IPTV player app.

<p align="center">
<img src="./design/tunarr-guide.png">
<img src="./design/tunarr-channels.png">
</p>

## Disclaimer

- ⚠️ Tunarr is under **very active** development.
- ⚠️ Expect bugs and breaking changes!
- ⚠️ We are certain there are bugs, given the scale of this rewrite.
- ⚠️ **At this point, we do NOT recommend replacing dizqueTV with Tunarr!**
  - If you would like to try Tunarr, make sure to use a copy of your `.dizquetv` database folder!

## What is this?

Tunarr is a fork / rewrite / rebrand of [**dizqueTV**](https://github.com/vexorian/dizquetv) (which in itself was a fork of other projects!). This project was born out of both a love for TV and an appreciation for the work put into dizqueTV and its predecessors.

Tunarr has the following goals:

- Modernize the stack, both backend and frontend
- Provide an migration path for existing users
- Stabilize the program, fix bugs, and improve performance (Tunarr currently is developed and tested on Node 20.11.1, which offers [non-trivial performance improvements](https://blog.rafaelgss.dev/state-of-nodejs-performance-2023) over previous versions)
- Modernize and "prettify" the Web UI
- And of course, **Add a ton great new features!**

## Features

- **NEW** Stream your channels directly in the [browser using HLS](https://github.com/chrisbenincasa/tunarr/pull/116) (and soon [MPEG-DASH](https://github.com/chrisbenincasa/tunarr/issues/129))
- **NEW** Improvements to stream stability
- **NEW** [Dark mode!](https://github.com/chrisbenincasa/tunarr/pull/34)
- **NEW** Quickly find content you want for your channels with [advanced filtering and sorting](https://github.com/chrisbenincasa/tunarr/pull/210)
- Spoofed [HDHR](https://www.silicondust.com/hdhomerun/) tuner and a IPTV channel list, providing a large amount of flexibility and easing integration with [xTeVe](https://github.com/xteve-project/xTeVe) and Plex
- Customize channels with a logo, filler content ("commercials", music videos, prerolls, channel branding videos) between programming, and more!
- Docker image and prepackaged binaries for Windows, Linux, and Mac OS
- Use Nvidia for hardware encoding, including in Docker.
- Source content from multiple Plex servers
- Includes a WEB TV Guide where you can even play channels in your desktop by using your local media player.
- ~~Subtitle support~~ Subtitle support is currently in flux; it was removed to simplify the backend and stabilize the stream. Bringing this functionality back is tracked in #462.
- Auto-deinterlace content

## Limitations

- If you want to play the TV channels in Plex using the spoofed HDHR, Plex pass is required.
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
