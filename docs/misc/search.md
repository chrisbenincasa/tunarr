---
status: new
---

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
| `in` | Set includes | `title IN ["30 Rock", "Arrested Development"]` |
| `not in` | Set excludes | `genre NOT IN [comedy, horror]` |

## Number & Date

| Operator | Description | Example
|---|---|---|
| `:` or `=` | Equals | `video_width = 1920`|
| `<` | Less Than | `minutes < 30` |
| `<=` | Less Than or Equal To | `minutes <= 22` |
| `>` | Greater Than | `minutes > 60` |
| `<=` | Greater Than or Equal To | `minutes >= 60` |
| `!=` | Not Equals | `video_height != 2160` |
| `between` | Range query (`[]` used for inclusive and `()` for exclusive ranges) | `minutes between [10, 30]` |

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
| `release_year` | `number` | Program release year | `1990` |
| `release_date` | `date` | Program's original release date | `1990-12-05` (`YYYY-MM-DD` or `YYYYMMDD`) |
| `show_title` | `string` | Title of the show a program belongs to (only applicable to episodes) | 30 Rock |
| `show_genre` | `string` | Genre of the show a program belongs to (only applicable to episodes) | comedy |
| `show_tag` | `string` | Tag on the show the program belongs to (only applicable to episodes) | - |