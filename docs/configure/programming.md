# Programming

After creating a new channel, you will be presented with a blank Programming page.

Select "ADD MEDIA".

![Adding media to a channel](/assets/programming-addmedia.png)

Select the library you'd like to pull media from.

![Selecting library](/assets/programming-addmedia-library.png)

Add all of the shows you'd like this channel to include. 

If you'd like to add all episodes from a show, select "ADD SERIES".

If you'd only like to include specific seasons, expand the show by selecting the carrot on the left and select "ADD ALL" on each season you'd like to include.

If you'd like to add specific episodes but not the entire season, expand the season by selecting the carrot on the left and select "ADD EPISODE".

![Select show](/assets/programming-addshow.png)

Expand the menu on the right to view a summary of your changes.

![Expand menu](/assets/programming-expandmenu.png)

Select "ADD ITEMS" to save your changes. 

![Add item](/assets/programming-additem.png)

By default, your episode ordering will be alphabetical (by show name) and in the proper season order. In this example, we have two shows and the first show will play in its entirety progressing from specials through all seasons, and only then will the next show start playing. 

![Media added](/assets/programming-mediaadded.png)

If we instead wanted this similar to what we'd see on traditional television, select "SORT" and choose either Block Shuffle or Cyclic Shuffle. 

![Shuffle](/assets/programming-shuffle.png)

Block Shuffle will play a specific number of episodes from a show, proceed to the next show, play that same number of episodes, proceed to the next show, etc. 

By default, when a show completes airing, it will be absent from your schedule until all of the remaining shows complete airing, where the schedule will then be repeated. This means that as you reach the end of your schedule, it may be dominated by one or two shows that have a longer runtime or more episodes than others.

To get around this, select "Make perfect schedule loop". This will attempt to have all shows complete airing at the same time.

![Block shuffle](/assets/programming-blockshuffle.png)

Please note the perfect schedule loop option does not currently support larger channels. If you see the below error, your channel has too many episodes to use this feature. In this case, the "Loop Short Programs" option can be used.

![Block shuffle loop error](/assets/programming-blockshuffle-noloop.png)

Cyclic Shuffle will alternate between shows while attempting to preserve the episode sequence. So in this example, it will play S00E01 from show 1, then play S00E01-E02 from show 2, then S01E01-E02 from show 1, then S01E01 from show 2, etc. Compared to Block Schedule, Cyclic Shuffle is randomized, so it will not always display the same number of episodes from a show. Cyclic Shuffle also does not support any features to create even blocks, so the end of your schedule will likely be dominated by a few shows with larger episode counts and runtime. 