# Playlists

!!! info
    Playlists were called "Custom Shows" before this release. The API still uses the old name, at `/api/custom-shows`.

A playlist is an ordered list of programs that scheduling tools treat as a single show. Ordering operations in the scheduling tools follow the playlist's order. Slot editors can schedule a playlist as if it were a "regular" show. Programs in a playlist are grouped by the playlist, not by their _actual_ show. This lets you build more complex groupings of content for your channels.

A playlist can be created empty, but slot editors only offer it once it has programs with a duration greater than zero. Programs with no duration cannot be scheduled, so a playlist made only of them counts as empty. See [Time Slots](../scheduling/time-slots.md#empty-or-deleted-playlists) and the [Slots Editor](../scheduling/random-slots.md#empty-or-deleted-playlists).

## Updating Content Through the API

`PUT /api/custom-shows/{id}` treats the `programs` field as follows.

| `programs` value | Result |
|------------------|--------|
| Omitted | Content is unchanged |
| Empty array | All content is removed |
| Non-empty array | Content is replaced, in the given order |
| Contains an unknown program ID | HTTP 400; name and content are unchanged |

## External Sync

A playlist can be linked to a playlist on a connected media source. When synced, Tunarr keeps the playlist's content in step with the upstream playlist.

### Supported Sources

| Source | Playlist Type |
|--------|--------------|
| Plex   | Playlists    |

### Setting Up Sync

When creating or editing a playlist:

1. Enable the **Sync with external playlist** toggle.
2. Select a **Media Source** (currently Plex only).
3. Select the **Playlist** from that media source to sync with.
4. Save the playlist.

An initial sync runs immediately when a synced playlist is first created. After that, syncs run automatically on the same schedule as media source library refreshes (configured in Settings under the media source rescan interval).

### Manual Sync

On an existing synced playlist, click **Sync Now** to trigger an immediate sync. The last sync time is displayed next to the button.

### Behavior

- While a playlist is linked to an upstream playlist, its content is **read-only** — the "Add Media" button and drag-to-reorder controls are hidden.
- To manage content manually, disable the sync toggle and save.
- If the upstream playlist is empty at sync time, Tunarr empties the playlist to match and logs a warning. Slots that use the playlist then show an empty-playlist warning.
- Saving a synced playlist from the editor does not change its content. Only a sync does.
- Deleting the linked media source from Tunarr sets the sync reference to `null`; the playlist keeps its last-synced content.
