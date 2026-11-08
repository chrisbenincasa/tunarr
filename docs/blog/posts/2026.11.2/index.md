---
date: 2026-11-08
draft: true
slug: "2026.11.2"
categories:
  - Releases
---

# Tunarr 2026.11.2: Stream Selection Profiles

Tunarr now picks audio and subtitle tracks with **stream selection profiles**. A profile is an ordered list of rules, and each rule says which audio track to play and which subtitles to show when its condition matches. One profile can give anime Japanese audio with English subtitles, play the surround track for movies, and leave everything else on the file's defaults.

<!-- more -->

<!-- Screenshot: the profile editor with a few rules and the Test panel. Save it next to this file and link it as ![Profile editor](profile-editor.png). -->

## What profiles replace

Earlier versions split stream selection across two places. Preferred audio languages were a global setting under **Settings > FFmpeg**, and each channel had its own **Enable Subtitles** switch and subtitle languages. Profiles replace both, and you manage them under **Profiles > Stream Selection**.

Tunarr converts your old settings on upgrade, and playback should not change. Your preferred audio languages become a profile named **Migrated Defaults**, which becomes the default. Each set of channel subtitle preferences becomes its own profile, assigned to the channels that used it. See [Upgrading from earlier versions](../../../configure/stream-selection.md#upgrading-from-earlier-versions) for the one case worth checking.

## Rules and conditions

Tunarr checks rules from top to bottom, and the first rule whose condition matches decides the tracks. The editor's **Basic** mode builds conditions from program type, title, show, genre, library, track languages, and audio channel count. **CEL** mode takes any expression, such as `hasAudioLang("jpn") && program.type == "episode"`.

The **Test** panel runs your rules against a real program before you save, and shows which rule matched and which tracks it picked.

## Where profiles apply

You can assign a profile to a channel, a filler list, or a custom show. When a program plays, Tunarr tries the custom show or filler list profile first, then the channel's profile, then the default profile. A profile with no matching rule passes the program to the next one in that order. So a bumpers filler list can hold one rule that turns subtitles off, while the channel's profile handles everything else.

**System > Troubleshoot** shows every profile and rule Tunarr checked for a program, which helps when a track isn't the one you expected.

Read the full guide in [Stream Selection](../../../configure/stream-selection.md).
