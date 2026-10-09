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

1. Create a new branch from `main`, or from `dev` for a large feature (see [base branch](#pull-request-guidelines)):

    ```bash
    git checkout main
    git pull origin main
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
5. Push your branch and open a Pull Request against the branch you started from

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
- **Linting**: oxlint (config in `.oxlintrc.json`)
- **Pre-commit hooks**: Husky + lint-staged run automatically

### Import Aliases

- Server: Use `@/` prefix (e.g., `import { foo } from '@/services/foo'`)
- Web: Uses configured path aliases

## Pre-Commit Hooks

Tunarr uses [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/lint-staged/lint-staged) to automatically run checks before each commit. These hooks are installed automatically when you run `pnpm i`.

### What Runs on Commit

When you commit, the following checks run automatically on staged files:

- **Prettier** - Formats code and auto-fixes formatting issues
- **oxlint** - Lints code and reports errors

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

### Closing Issues on Release

`Fixes #1234` closes the issue as soon as the PR merges, before any release ships the fix. To keep the issue open until the fix is released, put this line in the PR description instead:

```
Closes-on-release: #1234
```

- The line must start with `Closes-on-release:`. List several issues on one line: `Closes-on-release: #1234, #1240`.
- When a stable release ships the PR, the release workflow comments on the issue and closes it. Prereleases don't count.
- When an issue needs several PRs, add the line only to the PR that finishes it.

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

## Pull Request Policy

These rules apply to every PR, however it was written. They apply to maintainers too.

### You own every line

- You are the author of everything in your PR, whoever or whatever typed it.
- You must understand each change well enough to explain it in review.
- You must have run the change yourself and confirmed it does what the PR says.
- "The AI wrote that part" is not an answer to a review question.

### Design before code

Some changes need an agreed design before anyone writes code. Open an issue first and describe the design. A maintainer approves it by adding the `design approved` label. Then open the PR and link the issue in the "Design issue" section of the PR description.

A change needs a design issue if it does any of the following:

- Adds a new media source type or a new kind of stream source
- Changes the database schema (adds a migration)
- Adds a new runtime dependency
- Adds a new top-level feature, such as a new page, settings area, or scheduling mode
- Changes code in more than one package (`server`, `web`, `types`, `shared`) in a way that changes how they talk to each other, such as a new API shape or shared type
- Changes more than **500 lines** outside tests, or more than **1,500 lines** including tests. Neither count includes the generated files listed below.

The line counts leave out these generated files:

- `pnpm-lock.yaml`
- `server/src/migration/db/sql/meta/`
- `server/src/generated/`, `web/src/generated/`, `docs/generated/`
- `web/src/routeTree.gen.ts`
- `web/src/locales/`

The design issue should cover:

- The problem, and who has it
- The approach, and the main alternatives you rejected
- Which parts of the codebase change, and any schema or API changes
- How you will split the work into PRs that can each be reviewed on their own

Small fixes, docs changes, and refactors inside one module don't need a design issue. If you're unsure, ask in an issue or on Discord before you start.

### PRs that skip the design step

A bot checks every PR from an outside contributor. It detects the size limit, new migrations, new runtime dependencies, and new media sources. Maintainers flag the other triggers by hand.

When a PR needs a design and doesn't link an approved one, it gets converted to a draft and labeled `needs design`. The bot leaves a comment that lists what triggered it. The code stays where it is. Open a design issue and link it from the PR. When a maintainer labels the issue `design approved`, the bot re-checks every PR that links it and removes `needs design`. Rework or split the PR to match the design and mark it ready for review.

A PR labeled `needs design` for 30 days without an approved design will be closed. The clock pauses while the PR links an open design issue (labeled `design proposal`), since the PR is then waiting on a maintainer. If the design issue is closed without approval, a new 30 days starts.

Maintainers are the people listed in [`.github/CODEOWNERS`](https://github.com/chrisbenincasa/tunarr/blob/main/.github/CODEOWNERS). The bot doesn't check their PRs, but the same rules apply to them.

The bot doesn't check PRs opened before October 10, 2026. Maintainers may still apply these rules to them by hand.

### During review

- Address each comment with a change scoped to that comment. Don't regenerate or rewrite unrelated code, because that forces the reviewer to start over.
- If you don't know why your code does something, say so. Then find out before you change it.
- A PR whose author can't answer questions about their own code will be closed.

## AI Use

You may use AI tools to write code, tests, docs, and issues for Tunarr. The [Pull Request Policy](#pull-request-policy) applies the same way with or without AI. The rules below add to it.

### Disclose AI use

Every PR description says whether you used AI tools, in the "AI use" section of the PR template. If you did, name the tools and say what they did. For example:

- "Claude Code wrote most of the implementation. I wrote the tests and reviewed every change."
- "No AI tools used."

Disclosure is not a mark against your PR. It tells the reviewer where to look harder.

- Autocomplete that finishes the line you're typing doesn't need disclosure. Anything that writes whole functions, files, or changes does.
- Commit trailers such as `Co-Authored-By` are fine to keep but don't replace the PR statement. If your commits or PR description credit an AI tool and your "AI use" section says you used none, the bot will ask you to fix the section.

A maintainer may ask how you used AI. If your answer turns out to be false, the review ends and the PR is closed. Maintainers act on concrete evidence, such as AI tool trailers in your commits or your own statements. They don't act on how the code looks. Without such evidence, they ask questions about the code instead.

### AI in review replies

Write review replies yourself. You may use AI to understand a comment or check your answer, but don't paste model output into the thread.

### Issues and bug reports

AI can help you write an issue, but the content must come from you.

- **Bug reports.** Report what you saw. Your steps, logs, and screenshots must come from your own Tunarr install. If you include a guess about the cause, mark it as a guess. You may include an AI analysis of the cause, but put it in the bug template's "AI analysis" field and say whether you checked it. Maintainers treat unchecked AI analysis as a lead, not a finding.
- **Feature requests.** Describe the problem you have and how you would use the feature. A short request from you beats a long spec from a model.
- **Design issues.** A design issue is held to the same rule as a PR. You must understand the design and be able to answer questions about it. Use the "Design proposal" issue template, which asks you to disclose AI use.
- **Comments.** Don't answer other people's questions with AI output you haven't checked.

Issues that are mostly unchecked AI output will be closed.

### Security reports

Report vulnerabilities privately through [GitHub's vulnerability reporting](https://github.com/chrisbenincasa/tunarr/security/advisories/new), not in a public issue. See [SECURITY.md](https://github.com/chrisbenincasa/tunarr/blob/main/.github/SECURITY.md).

A report must include steps that reproduce the problem against a real Tunarr build. Output from an AI or a scanner that you haven't confirmed will be closed without a detailed response.

## Pull Request Guidelines

1. **Base branch** 
    1. **Target the `main` branch** by default. This includes fixes, chores, refactors, and small to medium features, even when they add a database migration.
    2. **Target the `dev` branch** only for large features that will need many prerelease iterations before they reach stable, such as infinite schedules or remote streaming sources. Ask in the issue or on Discord if you're unsure.
2. **Keep PRs focused** - one feature or fix per PR
3. **Use conventional commits** - follow the [commit message format](#commit-messages)
4. **Ensure all checks pass** before requesting review
5. **Update documentation** if your change affects user-facing behavior
6. **Add tests** for new functionality when applicable
