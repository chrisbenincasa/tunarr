#!/usr/bin/env bash
# Requires bash, which the Ubuntu base image provides.
set -e

DEFAULT_UID=1000
DEFAULT_GID=1000

# Under `docker run --user`, the caller picked the uid. Skip all user setup,
# including PUID/PGID.
#
# pkg extracts native modules to $HOME/.cache/pkg. HOME is /config, which
# only uid 1000 can write when just /config/tunarr is mounted, so fall back
# to /tmp for any other uid.
if [ "$(id -u)" != "0" ]; then
    if [ ! -w "$HOME" ]; then
        export HOME=/tmp
    fi
    exec "$@"
fi

PUID="${PUID:-$DEFAULT_UID}"
PGID="${PGID:-$DEFAULT_GID}"

for var in PUID PGID; do
    if ! [[ "${!var}" =~ ^[0-9]+$ ]]; then
        echo "error: $var must be a numeric id, got '${!var}'" >&2
        exit 1
    fi
done

# Grant the tunarr user access to mounted /dev/dri devices. A device group
# unknown inside the container gets a placeholder group with the host GID.
SUPP_GROUPS=""
if [ -e /dev/dri ]; then
    for dev in /dev/dri/renderD* /dev/dri/card*; do
        [ -e "$dev" ] || continue
        DEV_GID="$(stat -c '%g' "$dev")"
        DEV_GROUP="$(stat -c '%G' "$dev" 2>/dev/null || true)"
        if [ "$DEV_GROUP" = "UNKNOWN" ] || [ -z "$DEV_GROUP" ]; then
            groupadd -g "$DEV_GID" "devdri_$DEV_GID" 2>/dev/null || true
        fi
        SUPP_GROUPS="${SUPP_GROUPS:+$SUPP_GROUPS,}$DEV_GID"
    done
fi

if [ "$PGID" != "$DEFAULT_GID" ]; then
    groupmod -o -g "$PGID" tunarr
fi

if [ "$PUID" != "$DEFAULT_UID" ]; then
    usermod -o -u "$PUID" tunarr
fi

if [ -n "$SUPP_GROUPS" ]; then
    usermod -aG "$SUPP_GROUPS" tunarr 2>/dev/null || true
fi

# Hand /config to the tunarr user. Only files with the wrong owner are touched,
# so later boots are a read-only scan. Failure is a warning, because some
# mounts (root-squashed NFS, read-only) refuse chown but may still be usable.
if [ "${TUNARR_SKIP_CHOWN:-false}" != "true" ] && [ -d /config ]; then
    if ! find /config \( ! -user "$PUID" -o ! -group "$PGID" \) \
        -exec chown -h "$PUID:$PGID" {} + ; then
        echo "warning: could not change ownership of every file in /config." \
            "Tunarr runs as $PUID:$PGID and may fail to write there." >&2
    fi
fi

exec gosu tunarr "$@"
