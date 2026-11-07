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

Tunarr looks for artwork next to the movie's video file, in this order:

1. `<movie>-<type>.<ext>`, for example `The Matrix (1999)-poster.jpg`
2. `<type>.<ext>`, for example `poster.jpg` - only in a movie folder
3. `folder.<ext>` - only in a movie folder, and only for posters

A folder is a movie folder when it holds exactly one video file, or when the folder is named after the movie. Either case makes a short name unambiguous.

In a flat library, where many movies share one folder, the short names are skipped: a single `poster.jpg` would otherwise become the poster of every movie in the folder. Name the artwork after the movie there, as in the first form above.

Stacked movies (`cd1`/`cd2` files in one folder) count as several video files, so such a folder is not a movie folder and those movies use the movie-specific names too.

## Fallback

Without NFO files, Tunarr can still scan a movie directory. Tunarr will attempt to parse metadata from the filename itself, including year and external IDs (IMDb, TMDB) using some basic regex patterns.