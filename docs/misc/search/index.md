
<style>
    table {
        width: 100%;
    }
</style>

Tunarr features a built-in search index powered by [Meilisearch](https://www.meilisearch.com/). When scanning libraries from your media sources, Tunarr will add information to the search index, which can then be queried to filter content.

Tunarr's search supports a basic query language to create structured searches, as well as a "free text" search which looks within all fields. A syntax diagram of the Tunarr query language can be viewed [here](/search_syntax.html).

## Syntax

Tunarr's search feature different typed fields, such as `string`, `number`, and `date`. Each type has a set of supported operators.

## Strings

| Operator | Description | Example
|---|---|---|
| `:` or `=` | Equals | `title:"30 Rock"`|
| `<` or `<=` | Starts With | `title <= A` |
| `!=` | Not Equals | `title != "Sesame Street"` |
| `~` | Contains | `title ~ Hours` |
| `!~` | Not Contains | `title !~ "Sesame"` |
| `in` | Set includes | `title IN ["30 Rock", "Arrested Development"]` |
| `not in` | Set excludes | `genre NOT IN [comedy, horror]` |

## Numbers

| Operator | Description | Example
|---|---|---|
| `:` or `=` | Equals | `video_width = 1920`|
| `<` | Less Than | `minutes < 30` |
| `<=` | Less Than or Equal To | `minutes <= 22` |
| `>` | Greater Than | `minutes > 60` |
| `>=` | Greater Than or Equal To | `minutes >= 60` |
| `!=` | Not Equals | `video_height != 2160` |
| `between` | Range query (`[]` used for inclusive and `()` for exclusive ranges) | `minutes between [10, 30]` |

## Dates

Date fields support both absolute and relative date expressions.

### Absolute Dates

| Operator | Description | Example
|---|---|---|
| `:` or `=` | Equals | `release_date = 1990-12-05`|
| `<` | Before | `release_date < 2020-01-01` |
| `<=` | On or Before | `release_date <= 2020-01-01` |
| `>` | After | `release_date > 2000-01-01` |
| `>=` | On or After | `added_date >= 2024-06-01` |
| `!=` | Not Equals | `release_date != 2000-01-01` |
| `between` | Date range | `release_date between [2000-01-01, 2010-12-31]` |

Dates use `YYYY-MM-DD` or `YYYYMMDD` format.

### Relative Dates

Relative date expressions let you search based on how recently content was released or added, without specifying exact dates.

| Operator | Description | Example
|---|---|---|
| `inthelast` | Within the given time period | `release_date inthelast 2 weeks` |
| `notinthelast` | Outside the given time period | `added_date notinthelast 1 year` |

Relative dates take a number and a time unit: **day(s)**, **week(s)**, **month(s)**, or **year(s)**.

```
release_date inthelast 30 days
added_date inthelast 6 months
release_date notinthelast 1 year
```

These expressions are evaluated at query time, so "inthelast 2 weeks" always means the most recent two weeks from the current date.

## Compound Queries

Query clauses can be combined using the standard boolean operators `AND` and `OR`. Parentheses can be used to disambiguage query clause groups in more complex queries. For example:

```
genre IN [Horror, Comedy] AND title <= A
```

## Fields

Fields available for search:

| Field | Type | Description | Examples |
|-------|------|---|----|
| `title` | `string` | Program title | 30 Rock | 
| `type` | `string` | Program type | `show`, `movie`, `episode` |
| `rating` | `string` | Program content rating | PG-13 |
| `duration` | `number` | Program duration in milliseconds | - |
| `minutes` | `number` | Program duration in minutes | - |
| `seconds` | `number` | Program duration in seconds | - |
| `actor` | `string` | Actor name | Dwyane Johnson |
| `writer` | `string` | Writer name | - |
| `director` | `string` | Director name | - |
| `genre` | `string` | Program genre | `Comedy` |
| `tags` | `string` | Program tags | - |
| `video_codec` | `string` | Video codec of the program | `hevc` |
| `audio_codec` | `string` | Audio codec of the program | `ac3` |
| `video_height` | `number` | Video height dimension in pixels | `1080` |
| `video_width` | `number` | Video width dimension in pixels | `1920` |
| `video_bit_depth` | `number` | Video pixel bit depth | `10` |
| `audio_channels` | `number` | Whole number audio channels | `2`, `5.1` => `6` | 
| `audio_language` | `string` | Audio language (ISO 639-2 codes - see [Wikipedia page](https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes)), this looks at all available audio languages for the movie/shows | `eng`, `spa` |
| `subtitle_language` | `string` | Subtitle languages (ISO 639-2 codes - see [Wikipedia page](https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes)) | `eng` | 
| `release_year` | `number` | Program release year | `1990` |
| `release_date` | `date` | Program's original release date | `1990-12-05` (`YYYY-MM-DD` or `YYYYMMDD`) |
| `added_date` | `date` | When the program was added to Tunarr | `2024-06-01` |
| `show_title` | `string` | Title of the show a program belongs to (only applicable to episodes) | 30 Rock |
| `show_genre` | `string` | Genre of the show a program belongs to (only applicable to episodes) | comedy |
| `show_tags` | `string` | Tag on the show the program belongs to (only applicable to episodes) | - |
| `show_studio` | `string` | Studio on the show the program belongs to | - |
| `media_source_name` | `string` | Name of the media source (Plex server, Jellyfin server, etc.) the program was imported from | `My Plex` |
| `library_name` | `string` | Name of the library within the media source the program belongs to | `TV Shows` |