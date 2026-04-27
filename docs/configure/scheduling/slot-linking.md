# Slot Linking

Slot linking lets you tie two or more slots together so they share a single episode iterator. Without linking, every slot maintains its own independent position in its program list. With linking, the connected slots advance through their content as a group.

## Default Behavior: Isolated Slots

By default, every slot is **isolated**. Even if two slots reference the same show, each one keeps its own cursor. Consider a schedule with two slots that both play *Seinfeld*:

| Slot | Show | Order |
|------|------|-------|
| A | Seinfeld | Next |
| B | Seinfeld | Next |

Without linking, each slot independently walks through the episode list. Slot A plays S01E01, then S01E02 the next time it is chosen. Slot B *also* starts at S01E01 and advances on its own. The two never coordinate, so duplicate episodes are likely.

This isolation is intentional. It means adding a second slot for the same content is always safe and predictable -- it will not interfere with any other slot's progress.

## Linking Slots Together

To link slots, open a slot's edit dialog and use the **Link to existing slot** control. When you link slot B to slot A:

1. Both slots are assigned to the same **iteration group** (a shared UUID).
2. Slot B adopts the content configuration (show, ordering, direction, filler, mid-roll) of slot A.
3. Both slots now share one program iterator.

You can link more than two slots to the same group. All members of a group must reference the same content source and use the same ordering.

### What Gets Shared

When slots are linked, the following fields are copied from the source slot and kept in sync across the group:

- Content source (show, movie pool, custom show, or smart collection)
- Ordering (next, shuffle, chronological, etc.)
- Direction (ascending / descending)
- Filler configuration
- Mid-roll break configuration

### What Stays Independent

Each slot retains its own:

- Slot duration or start time
- Weight (in random/weighted mode)
- Cooldown
- Padding overrides

## Link Modes

Once slots are linked, you choose a **link mode** that controls how the shared iterator advances.

### Continue (default)

In **continue** mode, linked slots advance the shared iterator sequentially. Each time any slot in the group plays, it picks up where the previous one left off.

Example with two linked *Seinfeld* slots in continue mode:

| Turn | Slot Chosen | Episode Played |
|------|-------------|----------------|
| 1 | A | S01E01 |
| 2 | B | S01E02 |
| 3 | A | S01E03 |
| 4 | B | S01E04 |

This is useful for spreading a single show across multiple time slots or schedule positions while ensuring every episode airs exactly once before the list wraps around.

### Rerun

In **rerun** mode, the shared iterator only advances after every slot in the group has played the current episode. Each member of the group plays the same episode, and the group advances together.

Example with two linked *Seinfeld* slots in rerun mode:

| Turn | Slot Chosen | Episode Played |
|------|-------------|----------------|
| 1 | A | S01E01 |
| 2 | B | S01E01 |
| 3 | A | S01E02 |
| 4 | B | S01E02 |

This mimics the "rerun" pattern of traditional TV where the same episode airs at different times of day (e.g. a primetime airing and a late-night repeat).

## Validation Rules

Tunarr validates linked slot groups when you save a schedule. The following rules are enforced:

- **Consistent content**: All slots in a group must reference the same content source and ordering. Mismatched content keys produce an error.
- **Consistent link mode**: All slots in a group must use the same link mode. You cannot mix continue and rerun within a single group.
- **Orphaned link mode**: If a slot has a link mode set but no iteration group (i.e. it is not linked to anything), the link mode is silently stripped during validation.

## Linkable Slot Types

Not all slot types support linking. The following slot types can be linked:

| Slot Type | Linkable |
|-----------|----------|
| Movie | Yes |
| Show | Yes |
| Custom Show | Yes |
| Smart Collection | Yes |
| Filler | No |
| Flex | No |
| Redirect | No |

Filler, flex, and redirect slots do not maintain program iterators in the same way, so linking does not apply to them.

## Unlinking

To remove a slot from its group, open the slot's edit dialog and click **Unlink**. This clears the slot's iteration group and link mode, returning it to the default isolated behavior. The remaining group members are unaffected.

If you unlink all members of a group (leaving only one), that last slot continues to function normally as an isolated slot.

## Tips

- **Avoid accidental duplicates**: If you have two unlinked slots for the same show and want them to coordinate, link them. Otherwise they will independently iterate through the same episode list.
- **Continue mode for coverage**: Use continue mode when you want to spread a show across multiple schedule positions and play every episode once.
- **Rerun mode for repetition**: Use rerun mode when you want the same episode to air in multiple slots before moving on, simulating same-day reruns.
- **Order matters for rerun**: In rerun mode, the iterator advances after the entire group has consumed the current item. The order in which slots are chosen does not affect which episode plays -- all group members see the same one until they have all played it.
