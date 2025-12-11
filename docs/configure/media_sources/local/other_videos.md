# Movies

## Library Structure

Local "Other Video" libraries support freeform directory structures of arbitrary depth, including videos in the root library folder. These libraries are useful for organizing filler content.

```
commercials/
|
├ 1999/
| ├ Coke.mkv
| └ Coke.nfo
|
├ 2000/
| └ Food/ 
|   ├ Burger King.mkv
|   └ Burger King.nfo
|
├ Random.mkv
├ Random.nfo
|
```

## Metadata

Tunarr does its best to follow conventions laid out by the [Kodi Wiki](https://kodi.wiki/view/NFO_files/Movies) when reading NFO metadata for other video items. For each movie item, Tunarr will look for an NFO file called `$VIDEO.nfo` where `$VIDEO` is the exact name of the video file, with extensions swapped. Other video NFO metadata can have either a `movie` or `episodedetails` root tag.

## Artwork 

Tunarr will attempt to scan various artwork files for each movie, including thumbnails. These are generally used to power the UI and guide, but potentially have other future uses as well.

## Fallback

Without NFO files, Tunarr can still scan a directory. Tunarr will simply create an entry with the video name and no additional metadata.