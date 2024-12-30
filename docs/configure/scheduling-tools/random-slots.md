# Random Slots

Random Slots allow you to schedule specific shows to run during randomized time slots.

To schedule Random Slots for your channel programming, select "TOOLS", then "Random Slots".

![Random Slots](/assets/scheduling-tools-random_slots.png)

In this example, we want both "Yu-Gi-Oh! Duel Monsters" and "Batman Beyond" to air in 30 minute blocks. We have Pad Times set to 00:00 and 00:30, so the episodes will always try to air right at those times by using [Flex](/configure/channels/flex) to fill the empty time.

![Random Slots example](/assets/scheduling-tools-random_slots_example.png)

See below for an example of our current schedule. Note that due to the schedule starting at 4:43pm, the first episode will finish airing at 5:05pm, so a larger-than-normal amount of Flex time will be used to get the schedule back on track to have things air at 00:00 and 00:30. After the first airing, we see things normalized with a more appropriate 8-10 minutes of Flex after each episode.

![Random Slots preview](/assets/scheduling-tools-random_slots_preview.png)

In this example, one of our shows has far more episodes than the other but by default the episode Distribution is Uniform so the shows will be ordered with equal priority. If we instead wanted "Yu-Gi-Oh! Duel Monsters" to air 70% of the time, and "Batman Beyond" to air 30% of the time, we would set Distribution to Weighted and adjust the sliders.

![Random Slots example with weighting](/assets/scheduling-tools-random_slots_example_weighted.png)

See below for an example of our schedule now that "Yu-Gi-Oh! Duel Monsters" is Weighted to air 70% of the time.

![Random Slots preview with weighting](/assets/scheduling-tools-random_slots_preview_weighted.png)
