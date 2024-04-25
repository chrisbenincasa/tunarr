# Tunarr

Create live TV channels from media on your Plex servers, and more!

Configure your channels, programs, commercials, and settings using the Tunarr web UI.

Access your channels by adding the spoofed Tunarr HDHomerun tuner to Plex, Jellyfin, or Emby. Or utilize generated M3U files with any 3rd party IPTV player app.

<!-- <p align="center">
<img src="./design/tunarr-guide.png">
<img src="./design/tunarr-channels.png">
</p> -->

## What is this?

Tunarr is a fork / rewrite / rebrand of [**dizqueTV**](https://github.com/vexorian/dizquetv) (which in itself was a fork of other projects!). This project was born out of both a love for TV and an appreciation for the work put into dizqueTV and its predecessors.

Tunarr has the following goals:

- Modernize the stack, both backend and frontend
- Provide an [migration path](getting-started/setup.md#migrating-from-dizquetv) for existing users
- Stabilize the program, fix bugs, and improve performance (Tunarr currently is developed and tested on Node 20.11.1, which offers [non-trivial performance improvements](https://blog.rafaelgss.dev/state-of-nodejs-performance-2023) over previous versions)
- Modernize and "prettify" the Web UI
- And of course, **Add a ton great new features!**
