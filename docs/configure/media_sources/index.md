# Media Sources

Tunarr finds media to use in channels from one or more "Media Sources". You can connect multiple media servers and use content from any of them when building your channels.

<div class="grid cards" markdown>

-   **[Plex](plex.md)**

    ---

    Connect your Plex Media Server to access your movies, TV shows, and other media.

-   **[Jellyfin](jellyfin.md)**

    ---

    Connect your Jellyfin server to use its media libraries in your channels.

-   **[Emby](emby.md)**

    ---

    Connect your Emby server to access its media content.

-   **[Local Media](local/index.md)**

    ---

    Use media files directly from your local filesystem without a media server.

</div>

## How Media Sources Work

When you add a media source, Tunarr will scan its libraries and index the available content. This allows you to:

- Browse and search media when adding programming to channels
- Automatically detect metadata like titles, episode numbers, and artwork
- Keep your channel programming in sync when media is added or removed

!!! tip
    You can add multiple media sources of the same type. For example, you could connect two different Plex servers and use content from both.

## Scheduled Scans

Tunarr rescans your libraries on a schedule to pick up added, changed, and removed media. Set the schedule in **Settings → Scanner**.

| Option           | What it does                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Off              | No scheduled scans. Scan a library by hand from its media source when its contents change.          |
| Every few hours  | Scans every 1, 2, 3, 4, 6, 8, or 12 hours, counting from midnight, at the minute you choose.       |
| On selected days | Scans once on each day you pick, at the time you choose. Pick one day for a weekly scan.           |
| Custom (cron)    | Scans on a cron expression, such as `0 4 * * 0` for 4:00 AM every Sunday.                         |

The default is every 6 hours at 30 minutes past the hour. The page shows when the next scan will run, and changes apply as soon as you save.

Media server collections and [synced playlists](../library/playlists.md) sync on the same schedule. Turning scheduled scans off also turns off their automatic sync.

!!! note
    A scan of an unchanged library mostly compares what the source reports against what Tunarr already has, so it is usually quick. Turn scheduled scans off if even that load matters, for example on a NAS with a large local library that rarely changes.
