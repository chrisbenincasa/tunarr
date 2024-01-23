# Tunarr

Create live TV channel streams from media on your Plex servers.

This is a fork of [**dizqueTV**](https://github.com/vexorian/dizquetv) (which in itself was a fork of other projects!). We have the following goals:

- Modernize the stack, both backend and frontend
- Provide an migration path for existing users
- Modernize and "prettify" the Web UI
- Minimize breaking changes
- **Add great new features**

<img src="https://raw.githubusercontent.com/chrisbenincasa/tunarr/main/resources/dizquetv.png" width="200">

Configure your channels, programs, commercials and settings using the Tunarr web UI.

Access your channels by adding the spoofed Tunarr HDHomerun tuner to Plex, Jellyfin or emby or utilize the M3U Url with any 3rd party IPTV player app.

EPG (Guide Information) data is stored to `.tunarr/xmltv.xml`

## Features

- A wide variety of options for the clients where you can play the TV channels, since it both spoofs a HDHR tuner and a IPTV channel list.
- Ease of setup for xteve and Plex playback by mocking a HDHR server.
- Configure your channels once, and play them just the same in any of the other devices.
- Customize your channels and what they play. Make them display their logo while they play. Play filler content (&quot;commercials&quot;, music videos, prerolls, channel branding videos) at specific times to pad time.
- Docker image and prepackage binaries for Windows, Linux and Mac.
- Supports nvidia for hardware encoding, including in docker.
- Select media (desired programs and commercials) across multiple Plex servers
- Includes a WEB TV Guide where you can even play channels in your desktop by using your local media player.
- Subtitle support.
- Auto deinterlace any Plex media not marked `"scanType": "progressive"`
- Can be configured to completely force Direct play, if you are ready for the caveats.

## Limitations

- If you want to play the TV channels in Plex using the spoofed HDHR, Plex pass is required.
- Tunarr does not currently watch your Plex server for media updates/changes. You must manually remove and re-add your programs for any changes to take effect. Same goes for Plex server changes (changing IP, port, etc).. You&apos;ll have to update the server settings manually in that case.
- Most players (including Plex) will break after switching episodes if video / audio format is too different. Tunarr can be configured to use ffmpeg transcoding to prevent this, but that costs resources.
- If you configure Plex DVR, it will always be recording and transcoding the channel&apos;s contents.

## Releases

- https://github.com/chrisbenincasa/Tunarr/releases

## Wiki

- For setup instructions, check [the wiki](https://github.com/vexorian/dizquetv/wiki)

## Development

[pnpm](https://pnpm.io/) is used for package management and development

### Start dev servers

Run from the root of the project:

```
pnpm run --parallel dev
```

## Contribute

- Pull requests welcome but please read the [Code of Conduct](CODE_OF_CONDUCT.md) and the [Pull Request Template](pull_request_template.md) first.
<!-- - Tip Jar: https://buymeacoffee.com/vexorian -->

## License

- The original dizqueTV is released under zlib license (c) 2020 Victor Hugo Soliz Kuncar: we've kept this
