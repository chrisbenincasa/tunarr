# Local Media

Local Media Sources allow scheduling media from your filesystem without requiring a media server like Plex or Jellyfin.

Tunarr traverses folders to discover metadata and media files which can then be scheduled to channels.

<div class="grid cards" markdown>

-   **[Movies](movies.md)**

    ---

    Add movie files with NFO metadata support.

-   **[Shows](shows.md)**

    ---

    Add TV series with episode organization and NFO metadata.

-   **[Other Videos](other_videos.md)**

    ---

    Add unstructured video files without specific metadata requirements.

-   **[Music](music.md)**

    ---

    Add music libraries with artist/album organization and embedded metadata support.

</div>

## Generating Metadata

There are many ways to generate NFO files for consumption by Tunarr if your media does not already have them. Popular *arr stack programs, Jellyfin, and Emby all support writing out NFO files for media.

## Folder Structure

For best results, organize your media following standard conventions:

**Movies:**
```
/movies/
  Movie Name (2024)/
    Movie Name (2024).mkv
    Movie Name (2024).nfo
```

**TV Shows:**
```
/shows/
  Show Name/
    Season 01/
      Show Name - S01E01 - Episode Title.mkv
      Show Name - S01E01 - Episode Title.nfo
```

**Music:**
```
/music/
  Artist Name/
    artist.nfo
    Album Name (2024)/
      album.nfo
      01 - Track Title.flac
```
