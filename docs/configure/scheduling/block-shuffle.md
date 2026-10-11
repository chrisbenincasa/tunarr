# Block Shuffle

Block Shuffle will play a specific number of episodes from a show, proceed to the next show, play that same number of episodes, proceed to the next show, etc.

## Options

| Option | Choices | Effect |
|---|---|---|
| # of Programs | Any number | Episodes per block |
| Episode Order | In Order, Random | Whether each show's episodes play in season and episode order |
| Show Order | Take Turns, Random | Take Turns cycles shows in a fixed order. Random picks a random show for each block, so the same show can play twice in a row. |
| Starting Episode | First Episode, Random Episode | Where each show starts. Only shown when Episode Order is In Order. |
| Loop Short Programs | On, Off | Repeats shows with fewer episodes until they match the longest show |

With Show Order set to Random, a show with more episodes comes up more often. Turn on Loop Short Programs to give every show the same number of blocks, so each one plays equally often and shorter shows start over.

[Cyclic Shuffle](cyclic-shuffle.md) is a preset of these options.

By default, when a show completes airing, it will be absent from your schedule until all of the remaining shows complete airing, where the schedule will then be repeated. This means that as you reach the end of your schedule, it may be dominated by one or two shows that have a longer runtime or more episodes than others.

To get around this, select `Make perfect schedule loop`. This will attempt to have all shows complete airing at the same time.

![Block shuffle](/assets/programming-blockshuffle.png)

Please note the perfect schedule loop option does not currently support larger channels. If you see the below error, your channel has too many episodes to use this feature. In this case, the "Loop Short Programs" option can be used.

![Block shuffle loop error](/assets/programming-blockshuffle-noloop.png)
