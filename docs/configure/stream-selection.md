# Stream Selection

Most media files carry more than one audio track and several subtitle tracks. **Stream selection profiles** decide which audio track plays and which subtitle track, if any, is shown.

Manage profiles under **Profiles > Stream Selection**.

## Concepts

A **profile** is an ordered list of **rules**. Each rule has:

- a **condition**, which decides whether the rule applies to the program being played
- an **audio action**, which picks the audio track
- a **subtitle action**, which picks a subtitle track or turns subtitles off

Rules are checked from top to bottom, and **the first rule whose condition matches wins**. Its actions are final: if a rule matches but its actions can't find a suitable track (for example, it asks for Japanese audio and the file has none), Tunarr uses the file's default audio track and shows no subtitles. It does not move on to the next rule.

Put specific rules first and a catch-all rule (condition `true`) last.

## Where profiles apply

A profile can be assigned to:

- a **channel**, under **Channels > Edit > Streaming > Audio & Subtitles**
- a **filler list**, on the filler list's edit page
- a **custom show**, on the custom show's edit page

When a program plays, Tunarr looks for a profile in this order:

1. **Source** — the custom show the program was scheduled from, or the filler list it is playing from. A filler list's profile applies only when the program plays *as filler*. The same episode scheduled normally uses the channel's profile.
2. **Channel** — the channel's profile.
3. **Default** — the profile marked as the default.
4. **Built-in** — the locked *Tunarr Default* profile.

If a profile has **no rule whose condition matches**, Tunarr moves on to the next profile in the list. This lets a filler list or custom show profile hold only a few special cases, while the channel's profile handles everything else.

A channel's fallback clip (see [Flex](channels/flex.md)) always uses the channel's profile.

## The default and built-in profiles

Tunarr ships with a locked **Tunarr Default** profile. It picks the file's default audio track and shows no subtitles. It can't be edited or deleted, but you can view it, duplicate it, and assign it.

One profile is marked as the **default**. It applies to everything that has no profile of its own. Change it with the **Default profile** selector on the profiles page, or the star button on a profile's row. If you delete the default profile, the built-in profile becomes the default.

## Upgrading from earlier versions

Earlier versions chose streams using two separate settings: a global list of preferred audio languages under **Settings > FFmpeg**, and an **Enable Subtitles** switch plus subtitle language preferences on each channel. On upgrade, Tunarr converts these into profiles:

- **Migrated Defaults** holds your preferred audio languages, with subtitles off, and becomes the default profile.
- For every distinct combination of subtitle preferences among channels that had subtitles enabled, Tunarr creates one profile named after its languages (for example, *Migrated: eng, spa subtitles*), and assigns it to those channels.

Playback should be unchanged. The old settings are no longer shown. Subtitles are now controlled entirely by the profile, so to turn subtitles off for a channel, assign a profile whose subtitle action is **Disable**.

## Actions

### Audio

| Action | Behavior |
| ------ | -------- |
| Default | The track the media marks as selected, then the one marked default, then the first track. |
| By language | The first track matching a language in the list, in list order. Can prefer the track with the most or fewest channels. Falls back to Default. |
| By title | The first track whose title contains the given text. Falls back to Default. |

### Subtitles

| Action | Behavior |
| ------ | -------- |
| Disable | No subtitles. |
| Default | The subtitle track marked as default, if any. |
| By language | The first track matching a language in the list, in list order. Can be limited to forced or default tracks, and can exclude image-based or external subtitles. |

Language codes accept ISO 639-1 (`en`) and both ISO 639-2 forms (`ger` and `deu`); they are treated as equivalent.

## Conditions

Conditions are written in [CEL](https://cel.dev). The profile editor's **Basic** mode builds common conditions for you; switch to **CEL** for anything else.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `program.title` | string | The program's title |
| `program.type` | string | `movie`, `episode`, `track`, `music_video`, or `other_video` |
| `channel.name` | string | The channel's name |
| `channel.number` | number | The channel's number |
| `audio.languages` | list of strings | Languages of the file's audio tracks |
| `audio.streams` | list | Audio tracks, each with `index`, `language`, `codec`, `channels`, `title`, `default`, `selected` |
| `subtitle.languages` | list of strings | Languages of the file's subtitle tracks |
| `subtitle.streams` | list | Subtitle tracks, each with `index`, `language`, `codec`, `type`, `title`, `default`, `forced`, `sdh` |

Helper functions, which treat equivalent language codes as equal:

| Function | Description |
| -------- | ----------- |
| `hasAudioLang("jpn")` | The file has an audio track in the language |
| `hasSubtitleLang("eng")` | The file has a subtitle track in the language |
| `hasLang("spa")` | Either of the above |
| `isMultiLanguage()` | The file has audio in two or more languages |

## Examples

**Japanese audio with English subtitles when available, otherwise defaults:**

| Condition | Audio | Subtitles |
| --------- | ----- | --------- |
| `hasAudioLang("jpn")` | By language: `jpn` | By language: `eng` |
| `true` | Default | Disable |

**No subtitles on bumpers:** create a profile with a single rule (`true`, Default audio, Disable subtitles) and assign it to your bumpers filler list.

**Surround sound for movies:**

| Condition | Audio | Subtitles |
| --------- | ----- | --------- |
| `program.type == "movie"` | By language: `eng`, prefer most channels | Disable |

## Debugging

To see why a program played with the audio or subtitles it did, open **System > Troubleshoot**, pick the program and channel, and run it. The **Stream Selection** section lists each profile Tunarr checked, in order, with every rule's result. The rule that was applied is highlighted. See [Stream Troubleshooter](../misc/troubleshooting.md).
