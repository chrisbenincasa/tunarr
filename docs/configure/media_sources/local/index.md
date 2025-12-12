---
status: new
---

# Local

!!! info
    This feature is only available on alpha builds! It will be released as part of Tunarr 1.0.

Local Media Sources allow scheduling media from your filesystem (i.e. no media server is necessary).

Tunarr traverses folders for Local Media Sources to discover metadata and media files which can then be scheduled to channels.

Currently, Tunarr supports the following media types for Local sources:

1. [Movies](/configure/media_sources/local/movies)
2. Shows
3. "Other" Videos (unstructured)

## Generating Metadata

There are many ways to generate NFO files for consumption by Tunarr if your media does not already have them. Popular *arr stack programs, Jellyfin, and Emby all support writing out NFO files for media.