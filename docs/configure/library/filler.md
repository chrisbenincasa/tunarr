# Filler

Filler lists are collections of content that are used by [Flex](/configure/channels/flex) to pad time between episodes. One reason to use Filler is to simulate traditional television by playing advertisements between episode airings. 

There are many places to source filler videos from. [DizqueTV's Wiki](https://github.com/vexorian/dizquetv/wiki) has plenty of filler repositories listed. Many of these are YouTube playlists, so you can use tools like MeTube to rip the playlist, and then add a new library to Plex with these filler videos, which can then be used by Tunarr's Filler lists. 

To get started, from the side panel select "Library", "EDIT FILLERS", then "NEW".

![Library](/assets/library.png)

![Filler](/assets/library-filler.png)

![Filler new](/assets/library-filler-new.png)

Add a name for your filler list, then select "ADD MEDIA". 

![Filler new add media](/assets/library-filler-new-addmedia.png)

Select the library with your Filler content, then select "ADD MOVIE" for each item you'd like to include. 

![Filler new add media 2](/assets/library-filler-new-addmedia2.png)

Expand the menu on the right to view a summary of your changes, then select "ADD ITEMS" followed by "SAVE". 

![Filler menu](/assets/library-filler-menu.png)

![Filler add items](/assets/library-filler-additems.png)

![Filler add items save](/assets/library-filler-save.png)

To use a filler list with your channels, edit your channel and select the [Flex](/configure/channels/flex) tab.

## Filler Types

When using slot-based scheduling tools ([Slot Editor](/configure/scheduling/random-slots), [Time Slots](/configure/scheduling/time-slots)), filler lists can be assigned to specific positions within a slot:

| Type | When it plays |
|------|--------------|
| **Head** | At the beginning of each slot |
| **Pre** | Before each program within a slot |
| **Post** | After each program within a slot |
| **Tail** | At the end of each slot |
| **Mid** | During [mid-roll breaks](/configure/scheduling/mid-roll-breaks) inserted within a program |
| **Fallback** | During flex time in the slot |

!!! note
    These filler types are only available in slot-based schedulers. When adding filler directly to a channel via the Flex tab, the filler is used to fill flex time only.

For details on mid-roll breaks, see the [Mid-Roll Breaks](/configure/scheduling/mid-roll-breaks) scheduling guide.

## Bulk Filler Assignment

Tunarr provides two ways to assign filler lists to multiple channels at once, saving time when you have many channels that share the same filler content.

### Assign a Filler List to Multiple Channels

From the **Library > Fillers** page, click the **Assign to Channels** button (playlist icon) in the row actions for any filler list. This opens a dialog where you can:

1. Set the **weight** and **cooldown** for the filler list
2. Select which channels should receive the filler list (use **Select All** / **Deselect All** for quick selection)
3. Click **Apply** to add the filler list to all selected channels

This uses "add" mode — existing filler assignments on those channels are preserved and the selected filler list is added alongside them. If a channel already has the filler list assigned, it will be skipped.

### Assign Filler Lists to Selected Channels

From the **Channels** page, use the row checkboxes to select one or more channels. A toolbar appears at the bottom of the page with an **Assign Fillers** button. Clicking it opens a dialog where you can:

1. Toggle **Replace all existing fillers** to choose between:
      - **Add mode** (default): keeps existing filler assignments and adds the selected ones
      - **Replace mode**: removes all existing filler assignments on the selected channels and replaces them with the new selection
2. Check the filler lists you want to assign
3. For each selected filler list, configure its **weight** (1–100) and **cooldown** (seconds)
4. Click **Apply** to save

After applying, a notification shows how many assignments were added and how many already existed.