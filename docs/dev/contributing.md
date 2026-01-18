# Contributing

Thank you for your interest in contributing to Tunarr! This guide will help you get started with development.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 22** or later
- **pnpm 10.28.0** or later (do not use npm or yarn; easiest to use `corepack` to get the right version)
- **Git**
- **FFmpeg** (for testing streaming features)

## Getting Started

### 1. Fork and Clone

1. Fork the repository on GitHub: [chrisbenincasa/tunarr](https://github.com/chrisbenincasa/tunarr)
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/tunarr.git
cd tunarr
```

### 2. Install Dependencies

```bash
pnpm i
```

### 3. Start Development Servers

```bash
pnpm turbo dev
```

This starts:

- **Backend server** on `http://localhost:8000`
- **Frontend dev server** on `http://localhost:5173/web`

## Repository Structure

Tunarr is a monorepo with four main packages:

| Package | Path | Description |
|---------|------|-------------|
| `@tunarr/server` | `server/` | Node.js backend (Fastify, SQLite) |
| `@tunarr/web` | `web/` | React frontend (Vite, Material-UI) |
| `@tunarr/types` | `types/` | Shared TypeScript types and Zod schemas |
| `@tunarr/shared` | `shared/` | Utility functions shared between packages |

## Common Commands

### Root-Level Commands

```bash
# Install all dependencies
pnpm i

# Start all dev servers
pnpm turbo dev

# Build all packages
pnpm turbo build

# Run all tests
pnpm turbo test

# Run the typechecker
pnpm turbo typecheck

# Format code with Prettier
pnpm fmt

# Lint changed files only
pnpm lint-changed
```

### Server Commands

```bash
cd server

pnpm dev              # Start server with hot reload
pnpm debug            # Start server with debugger attached
pnpm test             # Run server tests
pnpm test path/to/test.ts  # Run a single test file
pnpm generate-openapi # Regenerate OpenAPI spec
pnpm kysely           # Run Kysely CLI for database operations
pnpm tunarr           # Run CLI commands
```

### Web Commands

```bash
cd web

pnpm dev              # Start Vite dev server
pnpm bundle           # Build production bundle
pnpm generate-client  # Regenerate API client from OpenAPI spec
pnpm regen-routes     # Regenerate TanStack Router routes
```

## Development Workflow

### Making Changes

1. Create a new branch from `dev`:

    ```bash
    git checkout dev
    git pull origin dev
    git checkout -b feature/your-feature-name
    ```

2. Make your changes
3. Ensure code passes all checks:

    ```bash
    pnpm fmt
    pnpm lint-changed
    pnpm turbo typecheck
    pnpm turbo test
    ```

4. Commit your changes using [conventional commit](#commit-messages) format
5. Push your branch and open a Pull Request against `dev`

### Adding API Endpoints

When adding new API endpoints, follow these steps:

1. Define your route in `server/src/api/{domain}Api.ts`
2. Use Fastify with the Zod type provider for type-safe requests/responses
3. Register the route in `server/src/api/index.ts`
4. Regenerate the OpenAPI spec:

    ```bash
    cd server && pnpm generate-openapi
    ```

5. Regenerate the web client:

    ```bash
    cd web && pnpm generate-client
    ```

### Database Changes

The codebase uses both Kysely (legacy) and Drizzle ORM:

- **New code should use Drizzle ORM**
- Schema definitions are in `server/src/db/schema/`
- Database migrations are in `server/src/migration/`
- Access the database via `DBAccess`, which provides both `db` (Kysely) and `drizzle` (Drizzle) instances

### Working with Dependencies

When adding new services or components that need dependency injection:

1. Define your service key in `server/src/types/inject.ts`
2. Register your service in the appropriate module:
    - `DBModule.ts` for database services
    - `ServicesModule.ts` for business logic services
    - `StreamModule.ts` for streaming services
    - `FFmpegModule.ts` for FFmpeg-related services
3. Use `@injectable()` decorator and `@inject(KEYS.ServiceName)` for constructor injection

## Code Style

### General Guidelines

- **TypeScript**: All code must be written in TypeScript
- **No `as any`**: Never cast types using `as any`
- **Formatting**: Prettier handles formatting (run `pnpm fmt`)
- **Linting**: ESLint 9.x with flat config
- **Pre-commit hooks**: Husky + lint-staged run automatically

### Import Aliases

- Server: Use `@/` prefix (e.g., `import { foo } from '@/services/foo'`)
- Web: Uses configured path aliases

## Pre-Commit Hooks

Tunarr uses [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/lint-staged/lint-staged) to automatically run checks before each commit. These hooks are installed automatically when you run `pnpm i`.

### What Runs on Commit

When you commit, the following checks run automatically on staged files:

- **Prettier** - Formats code and auto-fixes formatting issues
- **ESLint** - Lints code and reports errors

If any check fails, the commit will be blocked. Fix the reported issues and try again.

### Bypassing Hooks (Not Recommended)

In rare cases where you need to skip pre-commit hooks:

```bash
git commit --no-verify -m "your message"
```

!!! warning
    Only bypass hooks when absolutely necessary. All checks will still run in CI, so skipping them locally just delays catching issues.

### Troubleshooting Hooks

If hooks aren't running after cloning:

```bash
pnpm i  # Reinstall dependencies to set up hooks
```

If hooks are misconfigured or you need to reinstall them:

```bash
pnpm exec husky install
```

## Commit Messages

Tunarr uses [Conventional Commits](https://www.conventionalcommits.org/) for commit messages. This standardized format enables automatic changelog generation and makes the git history easier to read.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Code style changes (formatting, semicolons, etc.) |
| `refactor` | Code changes that neither fix bugs nor add features |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks (deps, build config, etc.) |
| `ci` | CI/CD configuration changes |

### Scope (Optional)

The scope indicates which part of the codebase is affected:

- `server` - Backend changes
- `web` - Frontend changes
- `types` - Shared types package
- `shared` - Shared utilities package
- `docs` - Documentation
- `deps` - Dependency updates

### Examples

```bash
# Feature
git commit -m "feat(web): add dark mode toggle to settings"

# Bug fix
git commit -m "fix(server): resolve race condition in stream cleanup"

# Documentation
git commit -m "docs: update contributing guide with commit conventions"

# Refactor with scope
git commit -m "refactor(server): migrate channel queries to Drizzle"

# Chore without scope
git commit -m "chore: update dependencies"

# Breaking change (add ! after type)
git commit -m "feat(api)!: change channel endpoint response format"
```

### Commit Message Body

For complex changes, add a body to explain **what** and **why**:

```bash
git commit -m "fix(server): handle null media duration gracefully

Previously, media items with null duration would cause the scheduler
to crash. This change treats null duration as 0 and logs a warning.

Fixes #1234"
```

## Testing

- **Framework**: Vitest
- **Test files**: Use `.test.ts` extension
- **Test data**: Use `@faker-js/faker` for generating test data

```bash
# Run all tests
pnpm turbo test

# Run tests in watch mode
pnpm test:watch

# Run a single test file
cd server && pnpm test path/to/file.test.ts
```

## Architecture Overview

### Server

- **Fastify** for HTTP server with Zod type provider
- **Inversify** for dependency injection
- **Drizzle ORM** (preferred) and **Kysely** (legacy) for database access
- **better-sqlite3** for SQLite database
- **Meilisearch** for search functionality

Key directories:

- `api/` - Route handlers organized by domain
- `db/` - Database layer and schema
- `services/` - Business logic
- `stream/` - Video streaming pipeline
- `ffmpeg/` - FFmpeg wrapper and pipeline builder
- `external/` - API clients for Plex, Jellyfin, Emby

### Web

- **React 18** with TypeScript
- **Vite** for bundling
- **Material-UI v7** for components
- **TanStack Router** for file-based routing
- **TanStack Query** for data fetching
- **Zustand** for state management
- **React Hook Form** + **Zod** for forms

Key directories:

- `routes/` - File-based routing
- `components/` - Reusable components
- `hooks/` - Custom React hooks
- `store/` - Zustand stores
- `generated/` - Auto-generated API client

## Getting Help

- **GitHub Issues**: [Report bugs or request features](https://github.com/chrisbenincasa/tunarr/issues)
- **Discord**: [Join the community](https://discord.gg/JpFjERP7y) for discussion and support

## Pull Request Guidelines

1. **Target the `dev` branch** for all PRs
2. **Keep PRs focused** - one feature or fix per PR
3. **Use conventional commits** - follow the [commit message format](#commit-messages)
4. **Ensure all checks pass** before requesting review
5. **Update documentation** if your change affects user-facing behavior
6. **Add tests** for new functionality when applicable
