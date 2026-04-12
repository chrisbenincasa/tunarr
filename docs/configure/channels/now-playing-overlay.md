# Now Playing Overlay

Channels can display a "now playing" lower-third overlay on the stream, showing the current program's title, artist, album, and year. This is especially useful for music video channels where viewers want to know what's playing.

The overlay appears as a semi-transparent bar at the bottom of the video with text that fades in and out.

There are several ways to customize the overlay for a channel. Here are some details on specific options:

### Position

Controls whether the overlay appears at the bottom-left or bottom-right of the video.

### Show at Start

How long (in seconds) the overlay is visible at the beginning of each program. For example, a value of 8 means the overlay will appear for the first 8 seconds.

### Show at End

How long (in seconds) the overlay reappears before the program ends. Set to 0 to disable the closing overlay. This is useful for giving viewers a heads-up that the current program is about to end.

### Start Padding

Adds a delay (in seconds) before the opening overlay appears. For example, a value of 2 means the overlay won't appear until 2 seconds into the program. This can help avoid showing the overlay during intro sequences.

### End Padding

Adds a gap (in seconds) between the closing overlay and the end of the program. For example, a value of 2 means the closing overlay will disappear 2 seconds before the program ends.

### Fade Duration

Controls how long (in seconds) the text takes to fade in and out. Set to 0 for instant appearance. A value of 0.5 provides a subtle, smooth transition.

## Coming Up Next

The overlay can also display a "coming up next" card showing the next program's title and metadata. This appears as a separate overlay before the closing card.

### Duration

How long (in seconds) the "coming up next" card is shown. Set to 0 to disable this feature entirely.

### Offset from End

How far from the end of the program (in seconds) the "coming up next" card starts. For example, a value of 30 means it will appear 30 seconds before the program ends.

## Things to consider

- The overlay requires video transcoding. It will not appear when using HLS Direct or HLS Direct v2 stream modes, since those modes pass the video through without modification.
- If a program is too short to fit all configured overlays without overlapping, the "coming up next" card is skipped first, followed by the closing card.
- Program metadata (title, artist, album, year) comes from the media source (Plex, Jellyfin, Emby, or local file tags). For local files, embedded metadata from the file itself is preferred when available.
