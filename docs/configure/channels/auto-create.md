# Auto Create

!!! warning "Experimental"
    Auto Create is experimental. Its presets and options may change between releases.

Auto Create builds a complete channel from a preset. It picks the content, creates a smart collection for each part of the preset, and generates the schedule. Open it with the **AUTO CREATE** button on the Channels page.

## Steps

1. **Choose Style**: pick a preset.
2. **Select Content**: fill in each of the preset's content roles. Each role shows how many programs match.
3. **Review & Create**: set the channel name and number, then create the channel.

The new channel opens when it is created. Its name and number are filled in automatically if you leave them blank.

## Presets

| Preset | Schedule | You pick |
| ------ | -------- | -------- |
| 24/7 Shuffle | Random slots | Optional filters for all content |
| Movie Channel | Random slots | Optional filters for movies |
| Binge Channel | Random slots | One show |
| Genre Channel | Random slots | One or more genres |
| Actor / Director Channel | Random slots | One or more actors or directors |
| Decade Channel | Random slots | A range of years |
| Network Channel | Random slots | One or more networks or studios |
| Weighted Mix | Weighted random slots | A filter and a weight for each group |
| Classic TV Day | Time slots | A filter and a start time for each block |

## Content source

The **Media Source** and **Library** menus at the top of **Select Content** limit every role to one source and its enabled libraries. Turn on **Override** on a role to give that role its own scope.

Weighted Mix groups and Classic TV Day blocks have no picker. Give each one a filter or an override, otherwise it would match the whole library.

## What gets created

- One smart collection per role, named `<channel name> - <role>`. Find them under **Library > Smart Collections**.
- A channel in the `Auto-Created` group that uses the default transcode config.
- A [slot schedule](programming.md) that points at those smart collections.

After creation the channel is an ordinary channel. Edit its programming, properties, or collections as usual.

Creation fails without leaving anything behind when the channel number is taken, a filter cannot be parsed, or a role matches fewer programs than the preset needs.
