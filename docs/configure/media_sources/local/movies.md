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

## Fallback

Without NFO files, Tunarr can still scan a movie directory. Tunarr will attempt to parse metadata from the filename itself, including year and external IDs (IMDb, TMDB) using some basic regex patterns.