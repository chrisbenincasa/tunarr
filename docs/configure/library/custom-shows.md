# Custom Shows

!!! info
    Custom Shows will be renamed to "Playlists" an in upcoming release

Custom Shows are akin to classic playlists. Any ordering operations in scheduling tools will use the ordering as defined in the Custom Show. Custom Shows can be schedule as if they were "regular" shows in slot editors. Content within are grouped by the Custom Show and not their _actual_ show. This allows creating more complex groupings of content for use in channels.

A Custom Show can be created empty, but slot editors only offer it once it has programs with a duration greater than zero. Programs with no duration cannot be scheduled, so a show made only of them counts as empty. See [Time Slots](../scheduling/time-slots.md#empty-or-deleted-custom-shows) and the [Slots Editor](../scheduling/random-slots.md#empty-or-deleted-custom-shows).

## Updating Content Through the API

`PUT /api/custom-shows/{id}` treats the `programs` field as follows.

| `programs` value | Result |
|------------------|--------|
| Omitted | Content is unchanged |
| Empty array | All content is removed |
| Non-empty array | Content is replaced, in the given order |
| Contains an unknown program ID | HTTP 400; name and content are unchanged |

## External Sync

Custom Shows can be linked to an external playlist from a connected media source. When synced, the custom show's content is automatically kept in sync with the upstream playlist.

### Supported Sources

| Source | Playlist Type |
|--------|--------------|
| Plex   | Playlists    |

### Setting Up Sync

When creating or editing a Custom Show:

1. Enable the **Sync with external playlist** toggle.
2. Select a **Media Source** (currently Plex only).
3. Select the **Playlist** from that media source to sync with.
4. Save the Custom Show.

An initial sync runs immediately when a synced Custom Show is first created. After that, syncs run automatically on the same schedule as media source library refreshes (configured in Settings under the media source rescan interval).

### Manual Sync

On an existing synced Custom Show, click **Sync Now** to trigger an immediate sync. The last sync time is displayed next to the button.

### Behavior

- While a Custom Show is linked to an external playlist, its content is **read-only** — the "Add Media" button and drag-to-reorder controls are hidden.
- To manage content manually, disable the sync toggle and save.
- If the upstream playlist is empty at sync time, the Custom Show is emptied to match and a warning is logged. Slots that use the show then show an empty-show warning.
- Saving a synced Custom Show from the editor does not change its content. Only a sync does.
- Deleting the linked media source from Tunarr sets the sync reference to `null`; the Custom Show retains its last-synced content.