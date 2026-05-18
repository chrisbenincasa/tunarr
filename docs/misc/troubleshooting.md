# Program Troubleshooting

The Troubleshooting page helps diagnose streaming issues for individual programs. It is available under **System > Troubleshoot** in the main navigation.

## How It Works

Select a program (or navigate to this page from a program's detail view) and Tunarr will run a diagnostic session that analyzes the full streaming pipeline for that program. The troubleshooter checks:

- **Media source connectivity** -- Whether Tunarr can reach the media server hosting the content.
- **FFmpeg capabilities** -- Whether the configured FFmpeg installation supports the codecs and filters required for the program's streams.
- **Stream selection** -- Which video, audio, and subtitle streams would be selected based on the active transcode configuration and any stream selection rules (CEL expressions).
- **Transcoding pipeline** -- The full FFmpeg command that would be generated for the program, including filter chains, hardware acceleration, and output format.

## Using the Results

The troubleshooter produces detailed logs of each step in the pipeline. These logs can be downloaded as a file for sharing when reporting issues. Common problems this tool can surface:

- Missing or unreachable media files on a remote server
- Codec mismatches between the source media and the transcode configuration
- Hardware acceleration filters that are unavailable on the host system
- Stream selection rules that unexpectedly exclude audio or subtitle tracks
