# Channel Watermarks

Channels can have watermarks to aid in recreating a classic TV experience.

![](/assets/watermark_form.png)

There are many ways to customize watermarks for a channel. Here are some details on specific options:

### Watermark Period

This value can be used to fade a channel's watermark in/out every N minutes.

### Watermark on leading edge

When using intermittent watermarks, use this option to control whether the watermark begins in a visible (true) or hidden (false) state.

### Total watermark duration

This option controls the absolute duration the watermark can be displayed for a given program segment of a channel. Its value takes precedence over the 'watermark period' but does not disable it. For instance, you could configure a watermark period of 5 minutes with total duration of 45 mins. On a show that is one hour, the watermark will fade in/out for the first 45 minutes and then be hidden for the final 15 minutes.

## Hardware-accelerated overlays

When VAAPI hardware filters are enabled and FFmpeg provides the
`overlay_vaapi` filter, Tunarr keeps the main video on the GPU while compositing
still-image watermarks. Opacity, fades, and total watermark duration are
applied to the watermark input before it is uploaded. Tunarr falls back to the
software overlay when the hardware filter is unavailable, hardware filters are
disabled, the VAAPI driver is incompatible, subtitles also require an overlay,
or the watermark is animated.

## Overrides

Global settings, such as target resolution, bit rate, and buffer size can be overridden per-channel.
