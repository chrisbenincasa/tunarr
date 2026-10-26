# HLS boundary signaling and probe failures

Each new clip process restarts MPEG-TS continuity counters. The playlist marks
that boundary with `#EXT-X-DISCONTINUITY`; the segment packets also need the
restart flag that the output formats already intended to request. With `-f hls`,
`-mpegts_flags +initial_discontinuity` on the outer output does not reach the
nested MPEG-TS muxer. `HlsOutputFormat` and `HlsDirectOutputFormat` instead pass
`-hls_segment_options mpegts_flags=+initial_discontinuity` on subsequent
transcodes. The first-transcode condition and playlist markers are unchanged.

This does not change timestamp placement. HLS Direct V2 receives the signaling
correction but retains its existing timestamp handling. Plain MPEG-TS
output already passes the option to its owning muxer and is unchanged.

In a captured native HLS join, clearing only the transport discontinuity bits
brought back FFmpeg's corrupt-packet warning; leaving them set removed it.
Decoded audio/video hashes matched. That proves the signaling effect, not that
a particular client's intermittent freeze is resolved. Bounded Kodi playback
was healthy both before and after the correction, so it is compatibility
evidence rather than a reproduction of the reported TiviMate failure.

## Failed segment inspection

`GetLastPtsDurationTask` rejects a nonzero or signal-terminated `ffprobe` exit
even when stdout contains parseable packet lines. A failed probe can leave
partial output; that output must not be accepted as a successful end-time
measurement. Successful parsing and the caller's existing logged zero-offset
fallback are unchanged. This correction does not add audio-tail calculations
or encoder-priming compensation.
