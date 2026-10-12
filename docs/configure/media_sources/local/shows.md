# Shows

## Library Structure

Local TV Show libraries support several directory structures. Each show must have its own subfolder within the library. Season folders are optional, but recommended.

```
tv/
|
├ Breaking Bad/
| ├ Season 01/
| | ├ Breaking Bad (2008) - S01E01 - Pilot.mkv 
| | └ Breaking Bad (2008) - S01E01 - Pilot.nfo
| └ tvshow.nfo
|
├ Californication/
| ├ tvshow.nfo
| ├ Calfornication (2007) - S01E01 - Pilot.mkv
| ├ Calfornication (2007) - S01E01 - Pilot.nfo
| └ Calfornication (2007) - S01E01 - Pilot.en.srt

```

## Metadata

Tunarr does its best to follow conventions laid out by the Kodi Wiki for [shows](https://kodi.wiki/view/NFO_files/TV_shows) and [episodes](https://kodi.wiki/view/NFO_files/Episodes) when reading NFO metadata for movie items. For each show item, Tunarr will look for an NFO file called `tvshow.nfo` in the show's folder. Tunarr expects each episode to have its own NFO file which matches the name of the video file exactly, but with the `.nfo` extension instead of the video extension.

## Artwork 

Tunarr will attempt to scan various artwork files for each show, season, and episode, including posters, fanart, landscape, and banners. These are generally used to power the UI and guide, but potentially have other future uses as well.

## Fallback

Without NFO files, Tunarr can still scan a shows directory. For the show itself, Tunarr will simply create an entry with the show name and no additional metadata. For each episode, Tunarr uses the file name as the title and takes the episode number from the file name.

Tunarr also falls back when an NFO file exists but can't be used. This happens when the file isn't valid Kodi NFO, when it describes a different kind of item (for example a movie), or when an episode NFO has no entry for the episode number in the file name. Tunarr logs a warning and scans the item with fallback metadata instead of skipping it.