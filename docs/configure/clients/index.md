# Clients

Once you have your channels created in Tunarr, you're ready to watch them! Tunarr works with a variety of clients through its HDHomeRun emulation and M3U playlist support.

<div class="grid cards" markdown>

-   **[Plex](plex.md)**

    ---

    Add Tunarr as an HDHomeRun tuner in Plex to watch channels with full DVR integration.

-   **[Jellyfin](jellyfin.md)**

    ---

    Configure Jellyfin to use Tunarr channels via HDHomeRun or M3U.

</div>

## Other Clients

Tunarr generates M3U playlists that work with any IPTV player. Some recommended apps:

| Platform | App |
|----------|-----|
| iOS / Apple TV | [UHF](https://www.uhfapp.com/) |
| Android TV | [TiviMate](https://tivimate.com/) |
| Cross-platform | [VLC](https://www.videolan.org/vlc/) |

## Connection Methods

Tunarr supports two ways to connect clients:

### HDHomeRun Emulation

Tunarr emulates an HDHomeRun network tuner, allowing media servers like Plex, Jellyfin, and Emby to discover it automatically. This provides the most seamless integration with full guide data.

### M3U Playlists

For IPTV apps and other players, Tunarr generates M3U playlist files. Access them at:

- **All channels**: `http://your-tunarr-ip:8000/api/channels/m3u`
- **XMLTV guide**: `http://your-tunarr-ip:8000/api/xmltv`
