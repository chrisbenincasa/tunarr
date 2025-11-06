# Scheduling Tools

Tunarr offers a range of tools for modifying channel schedules. However, it is important to first become familiar with Tunarr's scheduling [concepts](./concepts.md).

* [Slot Editor](random-slots.md) allows assigning programming to "slots" of fixed or dynamic duration. Slots can then be played back sequentially or at random when generating a schedule.

* [Time Slots](time-slots.md) mimic traditional TV scheduling, where programs are assigned to a particular start time and duration.

* [Block Shuffle](block-shuffle.md) is a simpler version of slot editor. Randomly chooses "blocks" of programming of a chosen size.

* [Cyclic Shuffle](cyclic-shuffle.md)

* [Balance](balance.md) lets you pick the weight for your shows to air some shows more frequently than others. 

* [Replicate](replicate.md) will create copies of the same schedule and play them in sequence. This typically is not needed as Tunarr already handles replaying a schedule once complete. Some use this as an intermediate tool before applying other tools, like balance.

* [Consolidate](consolidate.md) merges contiguous match flex and redirect blocks into singular spans. 