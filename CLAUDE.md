# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tunarr is a live TV channel creation platform that allows users to create custom TV channels using media from local files or remote media servers such as Plex, Jellyfin, or Emby servers. It's a TypeScript monorepo using pnpm workspaces and Turbo for task running.

## Repository Structure

This is a monorepo with four main packages:

- **server** (`@tunarr/server`): Node.js backend (Fastify server, SQLite database)
- **web** (`@tunarr/web`): React frontend (Vite + Material-UI)
- **types** (`@tunarr/types`): Shared TypeScript types and Zod schemas
- **shared** (`@tunarr/shared`): Utility functions shared between server and web

## Code Style

- Never cast types using `as any`

## Development Setup

### Package Manager & Task Runner

- Use **pnpm** (v9.12.3) for all dependency management - never use npm or yarn
- Use **Turbo** for running tasks across the monorepo
- Node.js version: 22 (specified in package.json engines)

### Common Commands

```bash
# Install dependencies
pnpm i

# Start all dev servers (backend on :8000, frontend on :5173/web)
pnpm turbo dev

# Build all packages
pnpm turbo build

# Run tests across all packages
pnpm turbo test

# Run single test file
cd server && pnpm test path/to/test.ts

# Format code
pnpm fmt

# Lint changed files only
pnpm lint-changed

# Run the typechecker
pnpm turbo typecheck

# Server-specific commands
cd server
pnpm dev              # Start server with tsx watch
pnpm debug            # Start server with debugger
pnpm kysely           # Run Kysely CLI for database operations
pnpm tunarr           # Run CLI commands (see src/cli/commands.ts)
pnpm generate-openapi # Generate OpenAPI spec

# Web-specific commands
cd web
pnpm dev              # Start Vite dev server
pnpm bundle           # Build production bundle
pnpm generate-client  # Generate API client from OpenAPI spec
pnpm regen-routes     # Regenerate TanStack Router routes
```

## Architecture

### Server Architecture

**Framework & Dependencies:**

- **Fastify** for HTTP server with Zod-based type provider
- **Inversify** for dependency injection (IoC container in `container.ts`)
- **Kysely** + **Drizzle ORM** for database access (dual ORM approach, migrating to Drizzle)
- **better-sqlite3** for SQLite database
- **Meilisearch** for search functionality
- **Zod** for schema validation

**Key Directories:**

- `api/` - Fastify route handlers organized by domain (channels, plex, jellyfin, etc.)
- `db/` - Database layer with both Kysely and Drizzle implementations
  - `schema/` - Database schema definitions
  - `interfaces/` - DB interface abstractions
  - `ChannelDB.ts`, `ProgramDB.ts` - Main database access classes
- `services/` - Business logic layer (event handling, scheduling, media source integration)
  - `scanner/` - Media scanning functionality
  - `scheduling/` - Channel scheduling logic
  - `startup/` - Startup tasks
- `stream/` - Video streaming pipeline (HLS, concat streams, FFmpeg integration)
  - Organized by media source (plex/, jellyfin/, emby/, local/)
- `ffmpeg/` - FFmpeg wrapper and pipeline builder
- `external/` - External API clients for Plex, Jellyfin, Emby
- `tasks/` - Background tasks and fixers
- `cli/` - CLI commands (accessible via `pnpm tunarr <command>`)

**Dependency Injection:**
The server uses Inversify for DI. Service registration happens in module files:

- `container.ts` - Root container and module registration
- `DBModule.ts` - Database services
- `ServicesModule.ts` - Business services
- `StreamModule.ts` - Streaming services
- `FFmpegModule.ts` - FFmpeg services

To inject dependencies, use the `@injectable()` decorator and constructor injection with `@inject(KEYS.ServiceName)`. Keys are defined in `types/inject.ts`.

**Database:**
The codebase uses both Kysely (legacy) and Drizzle ORM (current/future):

- Schema is defined in `db/schema/` using Drizzle
- Most queries still use Kysely but new code should use Drizzle
- Access via `DBAccess` which provides both `db` (Kysely) and `drizzle` (Drizzle) instances
- Database migrations are in `migration/`

### Web Architecture

**Framework & Libraries:**

- **React 18** with TypeScript
- **Vite** for bundling and dev server
- **Material-UI (MUI)** v7 for components
- **TanStack Router** for routing (file-based routes in `routes/`)
- **TanStack Query** for data fetching and caching
- **Zustand** for global state management
- **React Hook Form** for form handling
- **Zod** for form/data validation

**Key Directories:**

- `routes/` - File-based routing (generates `routeTree.gen.ts`)
- `components/` - Reusable React components
- `hooks/` - Custom React hooks
- `store/` - Zustand state stores
- `generated/` - Auto-generated API client code
- `pages/` - Legacy page components (being migrated to routes/)

**API Integration:**
The web app uses a generated API client (`generated/`) created from the server's OpenAPI spec. Regenerate with `pnpm generate-client` when server API changes.

### Shared Packages

**@tunarr/types:**

- Type definitions and Zod schemas shared between server and web
- Organized by domain: `plex/`, `jellyfin/`, `emby/`, `api/`, `schemas/`
- Build with `pnpm build` to generate `.d.ts` and `.js` files

**@tunarr/shared:**

- Utility functions for both server and web
- Notable: Custom DSL parser for scheduling/filtering (uses Chevrotain)

## Testing

- **Vitest** is used for testing across all packages
- Test files use `.test.ts` extension
- Run tests with `pnpm turbo test` or `pnpm test:watch` for watch mode
- Server tests often use `@faker-js/faker` for test data generation

## Code Style

- Prettier for formatting (config in root `package.json`)
- ESLint for linting (eslint 9.x with flat config)
- Husky + lint-staged for pre-commit hooks
- Import aliases: Use `@/` for server, web has configured path aliases

## Important Implementation Notes

### When Working with Database Code:

- Prefer Drizzle ORM for new queries over Kysely
- Both ORMs access the same SQLite database via `DBAccess`
- Database interfaces are in `db/interfaces/` - implement these for new DB access classes
- Use dependency injection to get database instances

### When Working with Streaming:

- Streaming logic is complex - see `stream/` directory
- Sessions are managed by `SessionManager`
- Different stream types: `VideoStream`, `ConcatStream`, `DirectStreamSession`
- FFmpeg pipeline is built using builder pattern in `ffmpeg/builder/`

### When Working with External Media Sources:

- External API clients are in `external/` (Plex, Jellyfin, Emby)
- Canonicalization logic converts external media to Tunarr's internal format
- Media scanning is handled by scanner services in `services/scanner/`
- Media source libraries are refreshed via `MediaSourceLibraryRefresher`

### When Adding API Endpoints:

1. Define route in `server/src/api/{domain}Api.ts`
2. Use Fastify + Zod type provider for type-safe requests/responses
3. Register in `api/index.ts`
4. Regenerate OpenAPI spec: `cd server && pnpm generate-openapi`
5. Regenerate web client: `cd web && pnpm generate-client`

### When Working with NFO Files:

- NFO parsing is in `server/src/nfo/`
- Different parsers for different media types (TV shows, movies, etc.)
- Uses Zod schemas defined in `NfoSchemas.ts`

## Build & Deployment

- Server builds to single executable using `@yao-pkg/pkg`
- Web builds static assets with Vite
- macOS app bundle support in `macos/` directory
- Docker images available (`chrisbenincasa/tunarr`)
