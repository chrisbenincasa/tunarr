# Trash

The Trash holds items that Tunarr scanned previously but did not find in a recent scan — a deleted file, a renamed folder, or a media server that stopped returning the item from its API. Trashed items stay in the database so you can review them before they are removed for good. They are unplayable in channels while they sit in the Trash.

## Emptying the Trash

Clicking **Empty Trash** starts a background job and returns immediately. Tunarr stays fully responsive while it runs — the UI, the API and active streams are unaffected. The Trash page shows a progress bar and a live item count while the job drains.

Emptying the Trash does three things:

1. **Deletes the trashed items** and everything attached to them: artwork, subtitles, credits, chapters, stream details, and their membership in channels, filler lists and custom shows.
2. **Rewrites affected channel lineups**, replacing each trashed item with [Flex](../channels/flex.md) of the same duration. Channel durations are therefore unchanged, and the rest of a lineup keeps its timing.
3. **Removes trashed shows, seasons, artists and albums** whose last remaining item is gone. A trashed show that still has playable episodes is kept, since deleting it would take those episodes' metadata with it.

!!! warning

    A channel that is streaming while the Trash is emptied has its lineup rewritten underneath it. Anything trashed that was due to play becomes Flex mid-playback.

## Cancelling

**Cancel** stops the job at the next batch boundary. Everything already deleted stays deleted; everything still in the Trash stays in the Trash. Emptying the Trash again picks up where it left off.

## Restarts

The request is recorded on disk. If Tunarr is stopped, crashes, or is restarted while the Trash is draining, the job resumes automatically about 30 seconds after the server comes back up — long enough that startup is never delayed. A job you cancelled yourself does not resume.

!!! note

    Restoring a database backup without its matching `settings.json` can lose the pending marker. The worst case is a drain that does not resume; click **Empty Trash** again to finish it.

## Performance

The first startup after upgrading to a version with this change builds six database indexes. On a large library that pass can take a moment. It happens once.
