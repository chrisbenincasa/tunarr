# Music Videos

## Library Structure

Local Music Video libraries support freeform directory structures of arbitrary depth, similar to [Other Videos](other_videos.md). Music videos can be organized by artist, genre, or any other folder layout.

```
music_videos/
|
├ Artist Name/
| ├ Song Title.mkv
| └ Song Title.nfo
|
├ Another Artist/
| ├ Video One.mp4
| ├ Video One.nfo
| ├ Video Two.mp4
| └ Video Two.nfo
|
├ Random Video.mkv
└ Random Video.nfo
```

## Supported Video Formats

Music video libraries support the same video formats as other local libraries, including `.mp4`, `.mkv`, `.avi`, `.mov`, `.wmv`, `.flv`, `.webm`, and others.

## Metadata

Tunarr reads NFO files following the `<musicvideo>` tag convention used by Kodi. For each music video, Tunarr looks for an NFO file named `$VIDEO.nfo` where `$VIDEO` matches the video file name with extensions swapped.

Supported NFO fields:

- `title` - Video title (required)
- `artist` - One or more artist names
- `album` - Album the video is associated with
- `plot` - Description or plot summary
- `premiered` - Release date (YYYY-MM-DD)
- `year` - Release year
- `genre` - One or more genre tags
- `director` - One or more directors
- `tag` - One or more keyword tags
- `studio` - Studio or record label
- `thumb` - Thumbnail artwork references

### Example NFO

```xml
<?xml version="1.0" encoding="UTF-8"?>
<musicvideo>
  <title>Thriller</title>
  <artist>Michael Jackson</artist>
  <album>Thriller</album>
  <year>1983</year>
  <genre>Pop</genre>
  <director>John Landis</director>
</musicvideo>
```

## Artwork

Tunarr scans for thumbnail artwork for each music video, following the same conventions as other local media types.

## Fallback

Without NFO files, Tunarr creates an entry using the video file name as the title. Stream metadata (resolution, codecs, duration) is still extracted via ffprobe.

## Ignoring Folders

To exclude specific folders from scanning, create an empty file named `.tunarrignore` in any folder you wish to skip. Folders and files starting with `.` are also ignored automatically.

## External Sources

Music videos can also be imported from [Jellyfin](../jellyfin.md) and [Emby](../emby.md) servers. Music Video libraries from these sources are scanned automatically when the library is enabled for synchronization.
