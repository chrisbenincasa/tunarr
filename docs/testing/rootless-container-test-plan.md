# Rootless Container Test Plan

Manual test plan for validating the non-root Docker container changes. Each test should be run against a freshly built image from the `rootless` branch.

## Prerequisites

```bash
# Build the image locally
docker build -t tunarr:rootless .

# Create test data directories
mkdir -p /tmp/tunarr-test-fresh
mkdir -p /tmp/tunarr-test-root-owned
sudo chown root:root /tmp/tunarr-test-root-owned

mkdir -p /tmp/tunarr-test-custom-uid
sudo chown 1500:1500 /tmp/tunarr-test-custom-uid
```

---

## 1. Basic Startup (Default PUID/PGID)

**Goal:** Verify the container starts normally with default settings and drops privileges.

```bash
docker run --rm -it \
    -v /tmp/tunarr-test-fresh:/config/tunarr \
    -e TZ=America/New_York \
    -p 8000:8000 \
    tunarr:rootless
```

**Expected:**

- [ ] Container starts without errors
- [ ] Tunarr web UI is accessible at `http://localhost:8000/web`
- [ ] Log output shows Tunarr is running
- [ ] Files created in `/tmp/tunarr-test-fresh` are owned by UID `1000`

**Verify process user (in another terminal):**

```bash
docker exec <container_id> ps aux
# Or:
docker exec <container_id> whoami
```

- [ ] Process is running as `tunarr`, not `root`

---

## 2. Custom PUID/PGID

**Goal:** Verify the entrypoint script correctly adjusts UID/GID.

```bash
docker run --rm -it \
    -v /tmp/tunarr-test-custom-uid:/config/tunarr \
    -e PUID=1500 \
    -e PGID=1500 \
    -e TZ=America/New_York \
    -p 8000:8000 \
    tunarr:rootless
```

**Expected:**

- [ ] Container starts without errors
- [ ] Web UI is accessible
- [ ] Files in `/tmp/tunarr-test-custom-uid` are owned by UID `1500` / GID `1500`

**Verify:**

```bash
docker exec <container_id> id
# Should show uid=1500 gid=1500
ls -ln /tmp/tunarr-test-custom-uid/
# Should show 1500 1500 ownership
```

---

## 3. Upgrade Path — Root-Owned Data Directory

**Goal:** Simulate upgrading from an older image where data was created as root.

```bash
# First, seed some data as root (simulating old container)
docker run --rm -it --user root --entrypoint /bin/bash \
    tunarr:rootless \
    -c "touch /tmp/test-file && ls -la /tmp/test-file"

# Now run the real test with root-owned host directory
sudo touch /tmp/tunarr-test-root-owned/db.sqlite
sudo chown root:root /tmp/tunarr-test-root-owned/db.sqlite

docker run --rm -it \
    -v /tmp/tunarr-test-root-owned:/config/tunarr \
    -e TZ=America/New_York \
    -p 8000:8000 \
    tunarr:rootless
```

**Expected:**

- [ ] Container starts successfully (entrypoint fixes ownership)
- [ ] No permission-denied errors in logs
- [ ] Files in the data directory are now owned by UID `1000`

---

## 4. Hardware Acceleration — VA-API/QSV (`/dev/dri`)

**Goal:** Verify the non-root user can access GPU render devices.

```bash
docker run --rm -it \
    --device /dev/dri:/dev/dri \
    -v /tmp/tunarr-test-fresh:/config/tunarr \
    -e TZ=America/New_York \
    -p 8000:8000 \
    tunarr:rootless
```

**Expected:**

- [ ] Container starts without errors
- [ ] No "permission denied" errors related to `/dev/dri` in logs

**Verify device access:**

```bash
docker exec <container_id> ls -la /dev/dri/
docker exec <container_id> id
# The `id` output should include the GID of the render/video device in the groups list
```

**Verify FFmpeg can access the device:**

```bash
docker exec <container_id> ffmpeg -init_hw_device vaapi=va:/dev/dri/renderD128 -f lavfi -i nullsrc -frames:v 1 -f null -
# Should NOT show "Permission denied" for the device
# It's OK if it fails for other reasons (no display, etc.) — the key is device access works
```

- [ ] FFmpeg does not report permission denied on `/dev/dri/renderD128`

---

## 5. Hardware Acceleration — Nvidia GPU

**Goal:** Verify Nvidia runtime still works with the privilege-drop entrypoint.

```bash
docker run --rm -it \
    --runtime nvidia \
    -e NVIDIA_VISIBLE_DEVICES=all \
    -v /tmp/tunarr-test-fresh:/config/tunarr \
    -e TZ=America/New_York \
    -p 8000:8000 \
    tunarr:rootless
```

**Expected:**

- [ ] Container starts without errors
- [ ] `nvidia-smi` works inside the container (or nvidia devices are visible)

**Verify:**

```bash
docker exec <container_id> nvidia-smi
# Should show GPU info (if nvidia-smi is in the image)
# If not available, verify no GPU-related permission errors in Tunarr logs
```

---

## 6. SSDP / HDHR Auto-Discovery (Graceful Degradation)

**Goal:** Verify that SSDP port 1900 bind failure doesn't crash the server.

```bash
docker run --rm -it \
    -v /tmp/tunarr-test-fresh:/config/tunarr \
    -e TZ=America/New_York \
    -p 8000:8000 \
    tunarr:rootless
```

Then enable HDHR auto-discovery via the web UI (Settings > HDHR > Auto-Discovery) and restart the container.

**Expected:**

- [ ] Server starts successfully even with auto-discovery enabled
- [ ] Log contains a warning message about SSDP failure (mentioning port 1900 / non-root)
- [ ] Web UI and all other features continue to work
- [ ] No crash or unhandled exception

---

## 7. Docker `--user` Override (Bypass Entrypoint Privilege Drop)

**Goal:** Verify the container works when the user explicitly passes `--user`.

```bash
docker run --rm -it \
    --user 1500:1500 \
    -v /tmp/tunarr-test-custom-uid:/config/tunarr \
    -e TZ=America/New_York \
    -p 8000:8000 \
    tunarr:rootless
```

**Expected:**

- [ ] Container starts (entrypoint detects non-root and skips privilege drop)
- [ ] Process runs as UID `1500`
- [ ] Note: files in `/tunarr/` (the install dir) may be unwritable since they're owned by `1000`. The container should still function (those files are read-only at runtime). If this causes issues, document as a known limitation.

**Verify:**

```bash
docker exec <container_id> id
# uid=1500 gid=1500
```

- [ ] Tunarr starts and serves requests

---

## 8. Meilisearch Subprocess

**Goal:** Verify the embedded Meilisearch process starts correctly under the non-root user.

```bash
docker run --rm -it \
    -v /tmp/tunarr-test-fresh:/config/tunarr \
    -e TZ=America/New_York \
    -p 8000:8000 \
    tunarr:rootless
```

**Expected:**

- [ ] No permission errors in logs related to Meilisearch
- [ ] Meilisearch data directory (`data.ms`) is created inside `/config/tunarr/`
- [ ] Search functionality works in the web UI (e.g., searching for programs)

**Verify:**

```bash
docker exec <container_id> ls -la /config/tunarr/data.ms/
# Files should be owned by the tunarr user (UID matching PUID, default 1000)
docker exec <container_id> ps aux | grep meilisearch
# Meilisearch process should be running as the tunarr user
```

---

## 9. Volume Permissions with Docker Compose

**Goal:** Validate the docker-compose workflow end-to-end.

```yaml title="test-docker-compose.yml"
services:
  tunarr:
    image: tunarr:rootless
    container_name: tunarr-rootless-test
    ports:
      - 8000:8000
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=America/New_York
    devices:
      - /dev/dri:/dev/dri
    volumes:
      - /tmp/tunarr-test-compose:/config/tunarr
```

```bash
mkdir -p /tmp/tunarr-test-compose
docker compose -f test-docker-compose.yml up
```

**Expected:**

- [ ] Container starts cleanly
- [ ] Data is written to `/tmp/tunarr-test-compose` with correct ownership
- [ ] Hardware acceleration device is accessible

---

## 10. Idempotent Restarts

**Goal:** Verify that restarting the container multiple times doesn't cause permission drift or startup failures.

```bash
# Start, let it fully boot, stop, start again (3 cycles)
for i in 1 2 3; do
    echo "=== Run $i ==="
    docker run --rm \
        -v /tmp/tunarr-test-fresh:/config/tunarr \
        -e TZ=America/New_York \
        -p 8000:8000 \
        --name tunarr-restart-test \
        tunarr:rootless &
    sleep 15
    docker stop tunarr-restart-test
    sleep 2
done
```

**Expected:**

- [ ] Each startup succeeds with no new errors
- [ ] File ownership remains consistent across restarts
- [ ] No "file locked" or "database is locked" errors

---

## 11. Large Data Directory (Performance)

**Goal:** Verify that the startup `chown` doesn't add unacceptable delay for large data dirs.

```bash
# Create a large directory structure to simulate a real install
mkdir -p /tmp/tunarr-test-large/images
for i in $(seq 1 1000); do touch "/tmp/tunarr-test-large/images/thumb_$i.jpg"; done

docker run --rm -it \
    -v /tmp/tunarr-test-large:/config/tunarr \
    -e TZ=America/New_York \
    -p 8000:8000 \
    tunarr:rootless
```

**Expected:**

- [ ] Startup completes in a reasonable time (< 5 seconds for the ownership fixup)
- [ ] Note the time difference vs. an empty data dir — document if significant

---

## 12. Read-Only Filesystem (Security Hardening)

**Goal:** Verify behavior when `--read-only` is passed (common in hardened deployments).

```bash
docker run --rm -it \
    --read-only \
    --tmpfs /tmp \
    -v /tmp/tunarr-test-fresh:/config/tunarr \
    -e TZ=America/New_York \
    -p 8000:8000 \
    tunarr:rootless
```

**Expected:**

- [ ] Document whether this works or what additional tmpfs mounts are needed
- [ ] If it fails, the error should be clear (not a silent hang)

---

## Cleanup

```bash
rm -rf /tmp/tunarr-test-fresh /tmp/tunarr-test-root-owned \
       /tmp/tunarr-test-custom-uid /tmp/tunarr-test-compose \
       /tmp/tunarr-test-large
```

---

## Summary Matrix

| Test | Area | Pass/Fail | Notes |
|------|------|-----------|-------|
| 1 | Basic startup | | |
| 2 | Custom PUID/PGID | | |
| 3 | Upgrade (root-owned data) | | |
| 4 | VA-API/QSV /dev/dri | | |
| 5 | Nvidia GPU | | |
| 6 | SSDP graceful degradation | | |
| 7 | --user override | | |
| 8 | Meilisearch subprocess | | |
| 9 | Docker Compose e2e | | |
| 10 | Idempotent restarts | | |
| 11 | Large data dir performance | | |
| 12 | Read-only filesystem | | |
