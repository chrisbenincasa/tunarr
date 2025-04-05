# Security

## Admin mode

Due to [this exploit](https://www.exploit-db.com/exploits/52079) Tunarr supports "admin mode". By default, admin mode is disabled. Some settings, like FFmpeg executable paths, can only be edited in the Tunarr UI when Tunarr is running in admin mode

There are several ways to update sensitive settings that require admin mode.

### Running in admin mode

### Standalone script

Pass the `--admin` flag when running the script, e.g.:

```bash
 ./tunarr.sh --admin
```

or on Windows:

```powershell
.\tunarr.bat --admin
```

You can also use an environment variable:

```bash
TUNARR_SERVER_ADMIN_MODE=true ./tunarr.sh
```

and again on Windows (Powershell):

```powershell
$Env:TUNARR_SERVER_ADMIN_MODE='true'
.\tunarr.bat
```

or Command Prompt:

```
set TUNARR_SERVER_ADMIN_MODE=true
.\tunarr.bat
```

### Docker

Start Tunarr server with the `admin` argument

```bash
docker run ... chrisbenincasa/tunarr:latest -- /tunarr/bundle.js --admin
```

!!! note

    <a href="https://github.com/chrisbenincasa/tunarr/issues/900" target="_blank">chrisbenincasa/tunarr#900</a> tracks simplifying running commands against Tunarr within a container.

or with the environment variable

```bash
docker run -e 'TUNARR_SERVER_ADMIN_MODE=true' ... chrisbenincasa/tunarr
```

### Updating sensitive values directly

Tunarr supports other run modes other than server. One is updating settings.json values directly. This can be done against a running Tunarr server without admin mode enabled.

```bash
./tunarr.sh settings update --settings.ffmpeg.ffmpegExecutablePath="FFMEPG_PATH" --settings.ffmpeg.ffprobeExecutablePath="FFPROBE_PATH"
```

This also works with Docker

```bash
docker run --rm \
  ...
  chrisbenincasa/tunarr -- /tunarr/bundle.js \
  settings update \
  settings.ffmpeg.ffmpegExecutablePath="FFMEPG_PATH" \
  settings.ffmpeg.ffprobeExecutablePath="FFPROBE_PATH"
```

## Trust proxy

When running Tunarr behind a reverse proxy server for HTTPS support, you will need to enable "trust proxy" for the generated XMLTV and M3U files to contain the correct protocol (e.g., `http` or `https`) and host. Without "trust proxy" enabled, Tunarr will not honor the `X-Forwarded-Proto` and `X-Forwarded-Host` headers forwarded from the reverse proxy.

There are several ways to enable "trust proxy".

### Standalone script

Pass the `--trustProxy` flag when running the script, e.g.:

```bash
 ./tunarr.sh --trustProxy
```

or on Windows:

```powershell
.\tunarr.bat --trustProxy
```

You can also use an environment variable:

```bash
TUNARR_SERVER_TRUST_PROXY=true ./tunarr.sh
```

and again on Windows (Powershell):

```powershell
$Env:TUNARR_SERVER_TRUST_PROXY='true'
.\tunarr.bat
```

or Command Prompt:

```
set TUNARR_SERVER_TRUST_PROXY=true
.\tunarr.bat
```

### Docker

Start Tunarr server with the `trustProxy` argument

```bash
docker run ... chrisbenincasa/tunarr:latest -- /tunarr/bundle.js --trustProxy
```

or with the environment variable

```bash
docker run -e 'TUNARR_SERVER_TRUST_PROXY=true' ... chrisbenincasa/tunarr
```
