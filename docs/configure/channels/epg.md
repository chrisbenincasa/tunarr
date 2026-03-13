# EPG

Tunarr generates an [XMLTV](https://wiki.xmltv.org/index.php/XMLTVFormat)-formatted Electronic Program Guide (EPG) for all active channels. This guide data can be consumed by media clients (Plex, Jellyfin, Emby, Channels DVR, etc.) to display program schedules and metadata alongside the live stream.

## XMLTV Output

Tunarr writes XMLTV data to an `.xml` file in the data directory, but clients should always consume it via the API endpoint rather than reading the file directly:

```
http://<tunarr-host>:<port>/api/xmltv.xml
```

The full URL is also available in the Tunarr web UI under **Settings > HDHR / M3U**. Point your client's guide data source at this URL to populate the program guide.

## Program Metadata

Tunarr populates the XMLTV output with program metadata sourced from your media libraries, including:

- Program title and episode title
- Description / plot summary
- Air date and year
- Content rating
- Cast and crew credits
- **Genres** — included under the XMLTV `<category>` tag, sourced from the genre metadata attached to each program in your media library. Clients that display genre information in their guide (e.g., Channels DVR) will pick these up automatically.

!!! info
    Genre data is only available for programs that have genre metadata in the originating media source. If a program's entry in your media server has no genres attached, the `<category>` tag will not be present for that program in the XMLTV output.