# Docs Platform & Versioning — Plan

Findings recorded 2026-09-15. Written from `main` at `8a2b36ca`. File and line references
were re-checked on `main`.

**Status:** Phase 1 step 1 done on `main`, unpushed. `docs/architecture/` moved to top-level
`architecture/`; a local build confirms it no longer ships. D2 and the remaining phases are not
started. Two decisions are open (see Open questions).

## Proposed decision

- Move the docs build from Material for MkDocs to **Zensical**. Fall back to **Starlight** if
  the test build fails.
- Ship **two docs channels**. Stable stays at tunarr.com and builds from `main`. Dev docs build
  from `dev` and deploy to a subdomain.
- **Do not use mike.** Each channel is a plain site at its own domain root.
- Mark feature availability inline with a version-aware `since()` macro. Mark alpha pages with
  the Material `status` front matter.

## Why now

- Material for MkDocs is in maintenance mode. Critical fixes end 2026-11-05.
- MkDocs 2.0 removes the plugin system and will not run Material.
- Zensical is the successor from the Material team. It reads `mkdocs.yml` directly.
- Zensical is pre-1.0. Latest release is 0.0.62 (2026-09-13).
- Nothing breaks on 2026-11-05. The stack just stops receiving fixes.

## Current state

| Part | Today |
|---|---|
| Generator | MkDocs 1.6.1 |
| Theme | Material, with `custom_dir: docs/overrides` |
| Plugins | `search`, `glightbox` |
| Markdown extras | admonitions (19 files), `pymdownx.snippets` auto-append, `abbr`, `md_in_html` |
| Deploy | `.github/workflows/docs.yml` runs `mkdocs gh-deploy --force` on `main` pushes touching `docs/**` |
| Hosting | GitHub Pages, `gh-pages` branch, `docs/CNAME` = tunarr.com |
| API reference | `docs/api-docs.html` loads Scalar from jsdelivr; dropdown from `docs/generated/openapi-specs.js` |
| Local preview | `scripts/run-docs-local.sh` builds `docker/docs.Dockerfile` |

## Defects in the current setup

These exist regardless of which tool is chosen.

| # | Defect | Evidence | Fix |
|---|---|---|---|
| D1 | Internal docs are public | MkDocs publishes every file under `docs/`. Deploy of `882829f` (2026-09-10) put `architecture/backend-arch-review-2026-08-26.html`, `architecture/server/` and `architecture/01-editor-collapse/` on tunarr.com | Move `docs/architecture/` out of `docs/`, or add it to `exclude_docs` |
| D2 | Unlinked pages are published | `configure/scheduling/balance.md`, `configure/scheduling/slot-linking.md`, `configure/transcoding.md`, `search_syntax.html` are live but absent from `nav` | Add to `nav` or delete |
| D3 | API dropdown is stale and has a 404 | `openapi-specs.js` tops out at `1.2.0-dev.1`, which is untracked. `v1.3.8` spec is tracked but not listed. Releases are at `v1.3.14` | Owned by `versioning-repair-plan.md` Phase 2 |
| D4 | Docs edits on `dev` are invisible | Deploy runs on `main` only. `mkdocs.yml:4` sets `edit_uri: edit/dev/docs/` | Phase 4 (dev channel) |
| D5 | Builds are unpinned | `docs.yml:32` installs without versions. `docs.Dockerfile` uses the `latest` image and installs unused `mike`. `api-docs.html:16` loads Scalar without a version | Pin all three |
| D6 | Header override will drift | `docs/overrides/partials/header.html` is a full copy of a Material partial marked "do not edit" | Re-derive during Phase 3, or replace with a smaller override |
| D7 | No build check on PRs | Broken links and nav errors surface only on deploy after merge | Add a PR workflow running a strict build |
| D8 | Alpha status is half-wired | `mkdocs.yml:133` defines status `new`. `extra.css:29` styles status `alpha`. No page sets `status:` | Rename the key to `alpha` |
| D9 | Alpha notes are stale | `plex.md:22` and `jellyfin.md:39` say "will be available in v1.0" | Replace with `since()` (Phase 5) |
| D10 | Sample abbreviations on every page | `docs-extras/includes/definitions.md` still holds the HTML/W3C examples | Replace with real terms or drop the auto-append |

## Why mike failed before

- mike never ran in CI. It ran only as the local Docker entrypoint, `ENTRYPOINT ["mike", "serve"]`,
  from `a94726b54` (2025-09-20) to `fcc9120b4` (2025-11-04).
- `mike serve` serves the `gh-pages` branch, not the working tree. Local edits never appeared
  without a prior `mike deploy`.
- CI's `mkdocs gh-deploy --force` rewrites `gh-pages` to a single commit on every run. The branch
  has exactly one commit today. Any mike version folders and `versions.json` were wiped by the
  next docs push.
- 57 root-absolute links in 14 files (`/assets/...`, `/configure/...`, `/generated/...`) resolve
  against the domain root. Under `/latest/` they break once old root files disappear. Worst
  offenders are `filler.md` and `clients/jellyfin.md` (13 each) and `clients/plex.md` (8).

If mike is ever retried, it needs all of the following.

- Deploy from CI only, with the `gh-deploy` step removed.
- `actions/checkout` with `fetch-depth: 0`.
- A `concurrency` group so `main` and `dev` deploys cannot race.
- One-time `mike set-default --push latest`, and a `CNAME` kept at the branch root.
- All root-absolute links converted to relative, enforced by a strict build.
- Redirects for existing `tunarr.com/configure/...` links, which move under `/latest/`.
- Zensical's mike is a fork of mike 2.2.0 that receives compatibility fixes only.

## Tool options

| Option | Migration effort | Two channels | Page badges | Inline "since" badges | Main risk |
|---|---|---|---|---|---|
| Zensical | Low. Reads `mkdocs.yml`; search built in; glightbox since 0.0.35 | Plain build per channel | `status` front matter | `macros` plugin (since 0.0.40) | Pre-1.0; header override and custom Python macros untested |
| Material, pinned | None | Plain build per channel | `status` front matter | `mkdocs-macros-plugin` | No fixes after 2026-11-05; tied to MkDocs 1.x |
| Starlight | Medium. `!!!` → `:::` in 19 files, nav to Astro config, lightbox plugin | Plain build per channel | Built-in sidebar badges | TS component, easy | ~50 pages rewritten; `starlight-versions` is snapshot-only and early |
| Docusaurus | Medium–high | Built in, snapshot copies per version | Manual | Component | MDX strictness; more JS shipped |
| VitePress | Medium | DIY | Manual | Component | Vue, used nowhere else in the repo |

GitHub Pages is adequate for stable. The only reason to change hosts is branch deploys and PR
previews, which the dev channel wants anyway.

## Phases

### Phase 1 — Stop publishing internal docs

1. Move `docs/architecture/` out of `docs/`, or add it to `exclude_docs` in `mkdocs.yml`.
2. Decide on the four unlinked pages in D2.
3. Merge to `main` so the deploy runs.

**Verify:** after deploy, `git ls-tree -r --name-only origin/gh-pages` lists no `architecture/`.

### Phase 2 — Hygiene

1. Pin `mkdocs-material` and `mkdocs-glightbox` in CI and the Dockerfile. Drop `mike`.
2. Pin the Scalar version in `api-docs.html`.
3. Add a PR workflow that runs `mkdocs build --strict`.
4. Rename `extra.status.new` to `extra.status.alpha` (D8).
5. Fix or drop `definitions.md` (D10).

**Verify:** a PR with a deliberately broken relative link fails the new check.

### Phase 3 — Zensical test build

1. `pip install zensical`, then `zensical build`.
2. Compare output against the current MkDocs build.
3. Check each of the following.
   - `partials/header.html` override renders the social links
   - `pymdownx.snippets` auto-append still works
   - glightbox opens images
   - search works
   - edit and view links point at the right branch
   - `macros` accepts a custom Python module (needed for Phase 5)
   - `!ENV` substitution in `mkdocs.yml` (needed for Phase 4)
4. If every check passes, switch CI and the local preview to Zensical.
5. If the header override or macros fail, evaluate Starlight before sinking time into workarounds.

**Verify:** CI deploy from Zensical produces a site with no missing pages versus the last MkDocs
deploy.

### Phase 4 — Dev docs channel

1. Keep the stable build unchanged. It deploys from `main` to the tunarr.com root.
2. Add a dev build from `dev` with `site_url: https://dev.tunarr.com/`.
3. Set `edit_uri` per channel, `edit/main/docs/` for stable and `edit/dev/docs/` for dev.
4. Show a banner on the dev build stating it documents unreleased builds.
5. Link stable ↔ dev from the header.
6. Deploy dev to a host with branch deploys. The same host can serve PR previews.

**Verify:** a docs change merged to `dev` appears on dev.tunarr.com and not on tunarr.com.

### Phase 5 — Feature availability markers

1. Add a `since(version)` macro.
   - CI passes the latest stable tag into `extra`.
   - Version newer than stable renders "Unreleased · {version}".
   - Otherwise it renders "New in {version}".
   - Optionally render nothing once the feature is N minor releases old.
2. Mark whole alpha pages with `status: alpha`.
3. Replace hand-written alpha admonitions, starting with `plex.md:22` and `jellyfin.md:39`.
4. Add an authoring rule to `docs/dev/contributing.md`. New feature sections get a `since()`.
   Never write "will be available in".

Usage:

```md
## Path replacements {{ since("1.4.0") }}
```

The comparison is semver. CalVer versions from `versioning-repair-plan.md` (`2026.8.0`) remain
semver-comparable and sort above `1.3.x`, so the macro works across the scheme change.

**Verify:** the same page shows "Unreleased" on dev.tunarr.com before the tag exists and
"New in" on tunarr.com after release, with no edits in between.

## Relationship to other plans

- `versioning-repair-plan.md` Phase 2 owns API spec naming and the dropdown (D3). This plan does
  not touch `generate-docs-script.ts` or `docs/generated/`.
- If that plan moves to CalVer first, `since()` arguments use the CalVer form.

## Suggested order

| Order | Phase | Notes |
|---|---|---|
| 1 | Phase 1 — internal docs | Do first; small and urgent |
| 2 | Phase 2 — hygiene | Independent of tool choice |
| 3 | Phase 3 — Zensical test | Before 2026-11-05 |
| 4 | Phase 4 — dev channel | Needs host decision |
| 5 | Phase 5 — markers | Needs Phase 3 macro check; most useful after Phase 4 |

## Open questions

1. Dev docs on a subdomain (recommended), or mike with `/latest/` and `/dev/`?
2. Which host serves the dev channel? Cloudflare Pages, Netlify, or a second GitHub Pages site?
3. The four unlinked pages in D2 — add to nav or delete? `balance.md` is commented out in nav.
4. How long does a `since()` badge stay visible?

## Sources

- [Zensical announcement](https://squidfunk.github.io/mkdocs-material/blog/2025/11/05/zensical/)
- [What MkDocs 2.0 means for your documentation projects](https://squidfunk.github.io/mkdocs-material/blog/2026/02/18/mkdocs-2.0/)
- [Zensical compatibility](https://zensical.org/compatibility/)
- [Zensical plugin support](https://zensical.org/docs/compatibility/mkdocs/plugins/)
- [Zensical mike compatibility](https://zensical.org/docs/compatibility/mkdocs/mike/)
- [Zensical releases](https://github.com/zensical/zensical/releases)
- [Scalar for Astro Starlight](https://scalar.com/products/api-references/integrations/starlight)
- [starlight-versions: About versioning](https://starlight-versions.vercel.app/guides/about-versioning/)
