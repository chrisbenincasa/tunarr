# FFmpeg

Many settings about how Tunarr transcode content can be configured on the FFmpeg page

## Executable Paths

Configure FFmpeg and FFprobe executable paths. Generally, both executables reside in the same directory.

!!! warning

    On 2024/10/01, an [exploit](https://www.exploit-db.com/exploits/52079) affecting dizqueTV was reported. This mainly affects instances of dizqueTV that were exposed to the public internet. The exploit affected Tunarr as well, and was patched in 0.14.0. This exploit is the reason ["admin mode"](/configure/system/security#admin-mode) exists.

    Additionally, we consider exposing Tunarr publicly to be an unsupported use-case. While we take security extremely seriously, this path is not one we currently test against. We would not recommend exposing Tunarr to the public via port forwarding at this point.

This setting can only be configured in ["admin mode"](/configure/system/security#admin-mode) due to its sensitivity (Tunarr attempts to run the inputted executable path!).
