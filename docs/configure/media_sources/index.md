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
