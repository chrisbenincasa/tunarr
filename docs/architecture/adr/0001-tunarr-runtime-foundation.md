# ADR-0001: Use Tunarr as the Runtime Foundation

- **Status:** Accepted
- **Date:** 2026-07-26
- **Decision owners:** ChannelForge maintainers

## Context

ChannelForge requires substantial virtual television infrastructure, including
media-server integrations, media synchronization, FFmpeg process management,
stream sessions, IPTV output, XMLTV generation, HDHomeRun compatibility, and
Docker deployment.

Tunarr already provides mature implementations of many of these capabilities
under the permissive zlib License.

Rebuilding all of these systems before validating ChannelForge's network-first
programming model would consume significant development effort without creating
the project's primary differentiator.

## Decision

ChannelForge will preserve Tunarr's repository history and use portions of its
runtime architecture and source code as a technical foundation.

ChannelForge will build a distinct product and domain layer above that
foundation. The defining ChannelForge model will organize programming around
networks, editorial identities, dayparts, blocks, deterministic rules,
templates, programming packs, and network-health analysis.

Inherited code will remain attributable. Altered versions will be identifiable
through Git history and project documentation.

The initial implementation will remain a modular monolith. Existing runtime
components will be isolated behind explicit interfaces before major internal
replacement or extraction is attempted.

## Consequences

### Positive

- Existing media-server integrations can be retained and adapted.
- Proven FFmpeg and streaming behavior does not need to be rebuilt immediately.
- IPTV, XMLTV, and HDHomeRun compatibility can remain available during the
  ChannelForge transition.
- Existing tests provide regression coverage.
- Development can focus on ChannelForge's network-first programming model.

### Negative

- Some inherited modules are coupled to Tunarr terminology and assumptions.
- The current SQLite persistence layer limits immediate PostgreSQL adoption.
- The existing frontend does not match the planned ChannelForge interface.
- Package names, configuration keys, paths, and documentation will require a
  controlled migration.
- Upstream fixes cannot always be merged automatically after substantial
  divergence.

## Constraints

- Do not claim inherited Tunarr code as original ChannelForge work.
- Do not remove or alter the inherited zlib license notice.
- Do not perform a mass rename before identifying compatibility boundaries.
- Do not couple the new programming engine directly to FFmpeg or stream-session
  internals.
- Preserve the tagged untouched baseline for comparison and recovery.