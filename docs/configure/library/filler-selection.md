# How Filler Is Chosen

When a channel reaches [Flex](/configure/channels/flex) time, Tunarr fills the gap one clip at a time. It picks a filler list, then picks a clip from that list, plays it, and repeats until the gap is full or nothing else fits.

## Settings that affect the choice

| Setting | Where to find it | What it controls |
|---|---|---|
| **Weight** | Channel → Flex → each filler list | Relative chance of picking that list. A list with weight 75 is chosen three times as often as one with weight 25. |
| **Cooldown (s)** | Channel → Flex → each filler list | How long after playing something from that list before the list can be chosen again. |
| **Filler List Cooldown (seconds)** | Channel → Flex → Filler Options | How long before the *same clip* can play again on this channel. Despite the name, this applies per clip, not per list. |
| **Clip length** | The media itself | Longer clips carry more weight per draw, and they can only be used in gaps large enough to hold them. |

## How one pick works

**Step 1 — choose a list.** Lists still inside their own cooldown are skipped. So are lists with no clip that both fits the remaining gap and is off cooldown. Tunarr then picks from what remains, in proportion to weight.

**Step 2 — choose a clip.** From the chosen list, Tunarr collects every clip that fits the remaining gap and is past the repeat cooldown, then orders them by how long ago each one last played. The clip that has waited longest gets the most weight, and a clip that has never played sits at the top of that order. Clip length multiplies that weight, so a longer clip beats a shorter one of equal staleness.

The winner plays. Tunarr subtracts its length from the gap and runs the whole process again for whatever time is left.

## Cooldowns are absolute

A clip never plays inside its cooldown. If every clip in every list is still cooling down, Tunarr shortens the flex block and tries again once the earliest one is ready, rather than repeating something early.

Two consequences follow from that:

- Set the repeat cooldown longer than the gap between your breaks and you will see dead air or the channel fallback, because nothing is eligible when the break arrives.
- A clip you just added has never played, so no cooldown applies to it. Newly added filler is favoured until it has been seen once.

## Why short clips appear more often

This surprises people, and it is not a bug. A three minute break holds six thirty-second spots but only one three-minute spot. Short clips are eligible for more of the gaps, so they get more slots to win. Clip length is factored into the weighting to push back against this, but it cannot cancel it entirely.

If you want long and short clips to appear about equally often, keep the lengths within a narrow range of each other.

## If you keep seeing the same few clips

Work through these in order.

1. **Check how many clips actually fit your breaks.** A clip longer than the gap is never eligible. If your breaks are 60 seconds and most of your clips run 90, only the short ones ever play. This is the most common cause by a wide margin.
2. **Check the repeat cooldown.** A very short cooldown lets a clip come back almost immediately. Setting it to roughly the length of one break is a reasonable starting point.
3. **Check your list weights.** One list with a much higher weight than the others will dominate, no matter how many clips the other lists hold.
4. **Check the per-list cooldowns.** A long cooldown on one list takes it out of the running for that period, concentrating plays on whatever is left.
