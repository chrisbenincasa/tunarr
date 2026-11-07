# ErsatzTV next issue draft: per-item audio overrides

> **Status (11/07/2026):** Draft, not filed. Waits on Christian's review. Summarized in `filler-audio-levels-2026-11-07.md` §3.2. Checked against the schema at ErsatzTV/next `c5cb065` (v0.2.5). No duplicate upstream as of 11/07/2026.

- Repo: `ErsatzTV/next`
- Title: `feat: per-item audio overrides in the playout`
- File with: `sed '1,/^---$/d' plans/etv-next-per-item-audio-issue-2026-11-07.md | gh issue create -R ErsatzTV/next --title "feat: per-item audio overrides in the playout" --body-file -`

---

Tunarr users want filler (commercials, bumpers, station IDs) to play at a different audio level than the main content on the same channel (chrisbenincasa/tunarr#1023). Tunarr's own ffmpeg pipeline does this per item (chrisbenincasa/tunarr#2459). Channels on next can't, because audio level is set only for the whole channel. `normalization.audio` holds the loudness settings, and there is no gain control at either level.

### Proposal

Add an optional `audio` block to `PlayoutItem` that overrides the channel's audio normalization for that item only. It reuses the field names from `AudioNormalizationConfig` and adds `gain_db`.

```json
{
  "id": "abc",
  "start": "2026-11-07T20:00:00-05:00",
  "finish": "2026-11-07T20:00:30-05:00",
  "source": { "...": "..." },
  "audio": {
    "gain_db": -6.0,
    "normalize_loudness": true,
    "loudness": {
      "integrated_target": -24,
      "range_target": 7,
      "true_peak": -2
    }
  }
}
```

- An omitted or null field keeps the channel's value.
- `normalize_loudness: false` turns normalization off for the item on a channel that has it on. `true` turns it on for an item on a channel that has it off.
- `loudness` replaces the channel's targets for the item. An unset target keeps the channel's target.
- `gain_db` applies on top of any normalization. With normalization on, it would go through loudnorm's `offset` option, which applies gain before the true-peak limiter. A `volume` filter placed before loudnorm does nothing useful, because loudnorm pulls the level back to its target.

Like `watermark` and `graphics`, the block rides on the item, so dynamic sources can return it from the existing per-item callback. No new mechanism is needed.

### Open questions

1. **Copy mode.** `normalize_loudness` is not allowed when `mode` is `copy`. I'd expect an item with an `audio` override to transcode its audio on a copy channel, the same way an item whose codec isn't in `copy_formats` does today. Rejecting the override on copy channels would also work.
2. **Channel-level gain.** A `gain_db` in `normalization.audio` would let Tunarr map its existing channel volume setting, which next has no equivalent for. Worth adding in the same change?
3. **Scope.** This covers audio only. Is a general per-item override of `normalization` (subtitle mode, deinterlace) worth designing for now, or is audio enough?
