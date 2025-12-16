# Scheduling Concepts

## Definitions

* **Lineup**: A channel's *lineup* describes its programming sequence. Channel lineups are looped infinitely and based off of the channel's start time.
* **Programming**: A channel's *programming* refers the actual media in a channel lineup
* **Filler**: *Filler* content refers to media that is used to "round out" a schedule. For instance, a 22-minute television episode may need 8 minutes of "filler" distributed within a 30-minute slot to replicate a true "TV" experience
* **Flex**: *Flex* time refers to chunks of time in which one or more pieces of filler are placed within a channel lineup. Content used to fill periods of *flex* time are not chosen until stream time.
* **Padding**: *Padding* generally refers to applying flex time in order to have content start at "nice" times, e.g. 12:00, 12:30, etc.
* **Slot**: Tunarr includes programming tools called *slot* editors. Using *slots* allows for fine-grained control over channel lineups. A *slot* refers to a "grouping" of programming with either a set duration or start time.
* **Filler Types**: When using slot editors, filler can be configured per-slot and be one of several types, each of which behave differently.
    * **Head**: Filler that plays at the _beginning_ of each slot
    * **Pre**: Filler that plays _before_ each program within a slot
    * **Post**: Filler that plays _after_ each program within a slot
    * **Tail**: Filler that plays at the _end_ of each slot
    * **Fallback**: Filler that is played during flex time in the slot
