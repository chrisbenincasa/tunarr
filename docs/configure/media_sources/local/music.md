# Music

## Library Structure

Local Music libraries expect a hierarchical structure with artist folders at the top level and album folders nested within each artist. Track files are scanned from within album folders.

```
music/
|
├ Billy Joel/
| ├ artist.nfo
| ├ folder.jpg
| ├ Greatest Hits Volume I & II (1985)/
| | ├ album.nfo
| | ├ folder.jpg
| | ├ 01 - Piano Man.flac
| | └ 02 - The Entertainer.flac
| |
| └ The Stranger (1977)/
|   ├ album.nfo
|   ├ 01 - Movin' Out.mp3
|   └ 02 - The Stranger.mp3
|
├ The Beatles/
| ├ artist.nfo
| └ Abbey Road (1969)/
|   ├ album.nfo
|   └ 01 - Come Together.m4a
|
```

## Supported Audio Formats

Tunarr supports the following audio file formats:

`.aac`, `.aif`, `.aifc`, `.aiff`, `.alac`, `.dff`, `.dsf`, `.flac`, `.mp3`, `.m4a`, `.ogg`, `.opus`, `.oga`, `.ogx`, `.spx`, `.wav`, `.wma`

## Metadata

Tunarr supports NFO files for both artists and albums. These follow conventions similar to those used by Kodi and other media managers.

### Artist Metadata

For each artist folder, Tunarr will look for an NFO file called `artist.nfo`. Supported fields include:

- `name` - Artist name
- `sortname` - Name used for sorting (e.g., "Joel, Billy")
- `musicBrainzArtistID` - MusicBrainz artist identifier
- `genre` - One or more genre tags
- `style` - One or more style tags
- `mood` - One or more mood tags
- `born` - Birth date (for solo artists)
- `formed` - Formation year (for bands)
- `biography` - Artist biography

### Album Metadata

For each album folder, Tunarr will look for an NFO file called `album.nfo`. Supported fields include:

- `title` - Album title
- `musicbrainzalbumid` - MusicBrainz album identifier
- `musicbrainzreleasegroupid` - MusicBrainz release group identifier
- `genre` - One or more genre tags
- `style` - One or more style tags
- `mood` - One or more mood tags
- `theme` - One or more theme tags
- `releasedate` - Release date
- `originalreleasedate` - Original release date
- `label` - Record label
- `compilation` - Whether the album is a compilation
- `boxset` - Whether the album is part of a boxset
- `albumArtistCredits` - Artist information including MusicBrainz ID

### Song Metadata

Tunarr reads native tags for a huge variety of music formats, including MP3, MP4, FLAC, Ogg, WAV, AIFF, and can read many metadata formats, including ID3v1, ID3v2, APE, Vorbis, and iTunes/MP4 tags. Some of the metadata extracted from individual music files, such as genre, are also retroactively applied to the parent album.

## Artwork

Tunarr will attempt to scan various artwork files for artists and albums.

**Artist artwork:**

- Poster: `poster.*` or `folder.*`
- Fanart: `fanart.*`
- Banner: `banner.*`

**Album artwork:**

- Poster: `poster.*` or `folder.*`

## Fallback

Without NFO files, Tunarr will extract metadata from embedded audio tags (ID3, Vorbis comments, etc.) using the track files themselves. This includes:

- Track title
- Track number
- Year and release date
- Genres (split on `;`, `,`, or `|` delimiters)

For artist and album names, Tunarr will use the folder name. Album folder names may include a year in parentheses (e.g., "Album Name (2024)") which Tunarr will parse automatically.

Tracks without a title or track number in their embedded metadata will be skipped during scanning.

## Ignoring Folders

To exclude specific folders from scanning, create an empty file named `.tunarrignore` in any folder you wish to skip. Folders and files starting with `.` are also ignored automatically.