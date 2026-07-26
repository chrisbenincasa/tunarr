# ChannelForge Architecture

## Mission

**Build television networks, not playlists.**

ChannelForge allows users to define the identity and programming strategy of a
television network. The application then builds and maintains the network's
schedule using deterministic, explainable rules.

## Current Phase

ChannelForge is currently in its architecture and foundation phase.

No broad package renaming, branding replacement, database migration, or
functional redesign should begin until the core domain boundaries and migration
strategy are documented.

## Technical Foundation

ChannelForge uses portions of Tunarr's existing open-source runtime foundation
to avoid rebuilding mature virtual television infrastructure unnecessarily.

Inherited or adapted areas may include:

- Plex, Jellyfin, and Emby integrations
- Media-library synchronization
- FFmpeg orchestration
- Stream-session management
- IPTV playlist output
- XMLTV guide generation
- HDHomeRun-compatible output
- Existing scheduling primitives
- Docker deployment infrastructure

## ChannelForge Product Layer

ChannelForge will introduce or substantially redesign:

- Networks and network identities
- Editorial and audience profiles
- Dayparts and programming blocks
- Deterministic schedule planning
- Hard constraints and weighted preferences
- Network templates
- Programming packs
- Programming Director recommendations
- Network health metrics
- Multi-user authorization
- Plugin contracts
- ChannelForge branding and interface

## Architectural Rules

1. Scheduling and playout remain separate subsystems.
2. The media catalog remains independent of any single media server.
3. Scheduling must be deterministic when given the same inputs and seed.
4. Hard constraints cannot be overridden by weighted preferences.
5. Integrations communicate through explicit adapter contracts.
6. Plugins do not receive unrestricted database or process access.
7. Docker Compose remains the canonical deployment model.
8. Unraid support is implemented as a deployment wrapper around the canonical
   container configuration.
9. Inherited Tunarr code remains attributable and traceable.
10. Architecture decisions are recorded before major implementation work.

## Architecture Decision Records

Architecture Decision Records are stored in:

`docs/architecture/adr/`