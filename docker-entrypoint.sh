#!/usr/bin/env bash
set -e

DEFAULT_UID=1000
DEFAULT_GID=1000

PUID="${PUID:-$DEFAULT_UID}"
PGID="${PGID:-$DEFAULT_GID}"

# If running as root (e.g. no --user flag), fix up ownership and drop
# privileges to the requested PUID/PGID.
if [ "$(id -u)" = "0" ]; then
    # Ensure the video and render groups exist (for /dev/dri access).
    # Use the host-provided GIDs when the devices are mounted so the
    # supplementary group membership actually grants access.
    SUPP_GROUPS=""

    if [ -e /dev/dri ]; then
        # Discover the owning group of the first render/card device we find
        for dev in /dev/dri/renderD* /dev/dri/card*; do
            [ -e "$dev" ] || continue
            DEV_GID="$(stat -c '%g' "$dev")"
            DEV_GROUP="$(stat -c '%G' "$dev" 2>/dev/null || true)"
            # If the group name is unknown inside the container, create one
            if [ "$DEV_GROUP" = "UNKNOWN" ] || [ -z "$DEV_GROUP" ]; then
                groupadd -g "$DEV_GID" "devdri_$DEV_GID" 2>/dev/null || true
            fi
            SUPP_GROUPS="${SUPP_GROUPS:+$SUPP_GROUPS,}$DEV_GID"
        done
    fi

    # Adjust the tunarr group's GID if it differs from the requested PGID
    if [ "$PGID" != "$DEFAULT_GID" ]; then
        groupmod -o -g "$PGID" tunarr
    fi

    # Adjust the tunarr user's UID if it differs from the requested PUID
    if [ "$PUID" != "$DEFAULT_UID" ]; then
        usermod -o -u "$PUID" tunarr
    fi

    # Add supplementary groups (video/render device access)
    if [ -n "$SUPP_GROUPS" ]; then
        usermod -aG "$SUPP_GROUPS" tunarr 2>/dev/null || true
    fi

    # Fix ownership of directories Tunarr needs access to.
    chown -R tunarr:tunarr /config
    chown -R tunarr:tunarr /tunarr

    # Drop to the tunarr user. Use exec so PID 1 is the actual process.
    exec gosu tunarr "$@"
fi

# If we're already running as a non-root user (e.g. via docker --user),
# just exec directly.
exec "$@"
