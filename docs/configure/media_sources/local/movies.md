# Movies

## Library Structure

Local Movie libraries support several directory structures. In general, we recommend having one subfolder per movie. Below is an example of some strucutres that are compatible with Tunarr.

```
movies/
|
├ The Matrix (1999)/
| ├ The Matrix (1999).mkv
| └ movie.nfo
|
├ The Matrix Reloaded (2003)/
| ├ The Matrix Reloaded (2003).mkv 
| └ The Matrix Reloaded (2003).nfo
|
├ The Matrix Revolutions (2003).mkv
├ The Matrix Revolutions (2003).nfo
|
```

## Metadata

Tunarr does its best to follow conventions laid out by the [Kodi Wiki](https://kodi.wiki/view/NFO_files/Movies) when reading NFO metadata for movie items. For each movie item, Tunarr will look for an NFO file called `movie.nfo` (when dealing with subfolders) or `$MOVIE_FILE.nfo` where `$MOVIE_FILE` is the exact name of the movie's video file, without the extension.

## Artwork 

Tunarr will attempt to scan various artwork files for each movie, including posters, fanart, landscape, and banners. These are generally used to power the UI and guide, but potentially have other future uses as well.

Artwork resolution follows [Kodi's movie artwork order](https://kodi.wiki/view/Movie_artwork): the file-specific long name (`$MOVIE_FILE-poster.png`, etc.) is preferred, and long names are compared across every image extension before any short name is considered, so `The Matrix (1999)-poster.png` beats a folder-level `poster.jpg`. The folder-level short names (`poster.jpg`, `folder.*`) are used as fallbacks only when the folder belongs to a single movie: it holds exactly one movie file, or is named after that movie (a folder holding two quality versions of the same film still keeps its shared poster). In a flat library, one `poster.jpg` next to several movies applies to none of them.

## Fallback

Without NFO files, Tunarr can still scan a movie directory. Tunarr will attempt to parse metadata from the filename itself, including year and external IDs (IMDb, TMDB) using some basic regex patterns.