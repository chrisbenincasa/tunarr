---
name: release-announcement
description: Write the release announcement blog post for an upcoming or just-cut Tunarr release, published at https://tunarr.com/blog/<version>/. Gathers every commit since the last stable tag, reads the PRs behind the user-visible ones, checks whether the pinned ErsatzTV next worker version changed and pulls the upstream release notes for every ErsatzTV/next version in between, then drafts docs/blog/posts/next/index.md in the house style with screenshots and opens a docs PR. Use this whenever the user asks to write, draft, start, update, or finish a release post, release announcement, blog post, or "what's new" for a Tunarr release, or asks what to say about the next release, even if they only say "draft the blog post for the release".
---

# Release announcement

Feature releases get a post under **Releases** on the docs site. The release workflow does the
publishing. It finds the one `draft: true` post on `main`, renames its folder to the version, sets
`date` and `slug`, and opens a `docs(blog): publish the <version> release post` PR. This skill writes
that draft. It lands on `main` through a normal docs PR before the release is cut.

`docs/dev/contributing.md` ("Release Announcements") is the source of truth for the mechanics. Read
it if anything below seems to disagree with it. `docs/blog/posts/2026.11.2/index.md` is the style
exemplar. Read it before writing.

## 1. Gather the facts

Work in a worktree off `origin/main`, never the main checkout:

```bash
git fetch -q origin
git worktree add -b docs/release-post-<slug> .claude/worktrees/release-post origin/main
cd .claude/worktrees/release-post
.claude/skills/release-announcement/scripts/gather-release.sh > <scratchpad>/release.txt
```

The script defaults to the last stable tag through `origin/main`. Pass `--from <tag> --to <ref>` for
any other range, such as a release that already shipped without a post. It prints:

1. the range and a CalVer guess for the version (`YYYY.M.PATCH`)
2. commits grouped as feat, fix, perf, breaking, and other
3. draft posts already on the target ref
4. the ErsatzTV next pin at both ends, and upstream release notes for each ErsatzTV/next release
   in between when the pin changed

Decide whether a post is due before writing anything:

- **Feature release** (any user-visible `feat`): write the post.
- **Fix-only release**: contributing.md says no post, because the GitHub release lists every fix.
  Tell the user, and write one only if they ask. An ErsatzTV next bump alone doesn't change this.
- **A draft already exists**: update it in place. The release workflow skips promotion when it
  finds more than one draft.

## 2. Read the PRs, not just the subjects

Commit subjects name the mechanism. The post needs the behavior a user sees. For each `feat`, each
`perf`, each breaking change, and each `fix` that a user could have noticed, read the PR:

```bash
gh pr view <n> --repo chrisbenincasa/tunarr --json title,body,files
```

Note what the user sees, where in the UI it lives (exact labels), the docs page that covers it, and
any upgrade caveat or migration. Check `docs/` for the guide page to link. If a feature has no guide
page, say so to the user rather than explaining the whole feature in the post.

Leave out work a user can't see: refactors, tests, CI, build, internal docs, dependency bumps
without a behavior change, and table or component ports that look the same. Leave out fixes for
bugs that never shipped in a stable release (introduced and fixed inside the range).

## 3. Translate ErsatzTV next changes

ErsatzTV next is an opt-in streaming backend. Tunarr runs the pinned `ersatztv-channel` worker
binary (`server/package.json` `ersatztvNext.releaseTag`). When that pin changes between two
releases, the worker's own changes ship in the Tunarr release, and the post must say what they are.
The script prints every upstream release in `(old, new]`, so a jump from v0.2.3 to v0.2.5 includes
v0.2.4's notes too.

Upstream notes describe the worker, its CLI, and its config files. Tunarr users never touch those.
Rewrite each item in Tunarr terms, and filter:

| Keep | Drop |
| ---- | ---- |
| Playback fixes: streams that failed, froze, ended early, or showed the error screen | `describe`, `run` flags, and other CLI changes |
| Hardware acceleration fixes (QSV, VAAPI, NVENC, Vulkan, VideoToolbox), named by GPU | Schema and config version bumps, compatibility tables |
| Watermark, subtitle, and audio fixes | Channel config or lineup config fields Tunarr sets itself |
| New source formats that now play | Fixes for regressions introduced inside the range (e.g. "regression in 0.2.4" when the range is 0.2.3 → 0.2.5, since no Tunarr release shipped 0.2.4) |
| Known issues, with a workaround a Tunarr user can apply | Workarounds that need hand-editing `channel.json` |
| A new required ffmpeg build, if it affects native installs | |

- Check the Tunarr PR that bumped the pin (the script lists it) for what changed alongside it, such
  as the ErsatzTV-ffmpeg version in the Docker image or new Tunarr-side checks.
- When unsure whether Tunarr sets a config field, check `server/src/stream/etv/EtvNextChannelConfigMapper.ts`.
- Merge duplicates across versions into one line.
- If the old pin is `none`, this release is the first to bundle the worker. Introduce the backend
  and link `../../../configure/ffmpeg/ersatztv-next.md`. Don't list upstream history.

The result goes in its own section, scoped to people who use the backend:

```markdown
## ErsatzTV next v0.2.5

This release updates the ErsatzTV next backend from v0.2.3 to v0.2.5. These changes apply to channels that use it.

- QSV streams no longer fail about 10 seconds in on Intel GPUs older than Tiger Lake.
- Still-image watermarks no longer disappear partway through a program.
- ...

See the upstream release notes for [v0.2.4](https://github.com/ErsatzTV/next/releases/tag/v0.2.4) and [v0.2.5](https://github.com/ErsatzTV/next/releases/tag/v0.2.5).
```

Put it after **Notable fixes** and before any breaking changes. Tunarr's own ErsatzTV next work
(UI, routing, diagnostics) stays in the feature and fix sections, because it isn't an upstream change.

## 4. Write the post

Path: `docs/blog/posts/next/index.md`, unless a draft already exists. Screenshots sit beside it.

```yaml
---
draft: true
categories:
  - Releases
---
```

Shape, following the 2026.11.2 post:

1. `# Tunarr <version>: <headline feature>`. Use the script's version guess. The promotion
   workflow replaces it with the real version, as long as the title keeps this form.
2. One or two paragraphs on the headline feature, then one sentence naming the other highlights.
   This is the excerpt on the Releases page.
3. `<!-- more -->`
4. An H2 section per major feature, with a screenshot each. Say what the user can do and where.
   End with a link to the guide page.
5. `## Smaller changes`. Bullets that start with a bold name.
6. `## Notable fixes`. One bullet per fix, written as the symptom that went away.
7. `## ErsatzTV next <version>`, when the pin changed (section 3).
8. `## Breaking changes`, for API or behavior changes that break a user's setup or tools.

Voice:

- Write for users, in the docs' plain style. UI labels in bold, settings paths as
  **Settings > General > Density**, code and API paths in backticks.
- No PR numbers, commit hashes, class names, or internal mechanisms. The GitHub release lists PRs.
- Link guide pages with paths relative to the post, such as `../../../configure/stream-selection.md`.
- Describe upgrade behavior plainly when a migration changes settings.
- Don't claim a behavior you didn't confirm in a PR or the code. Put open questions in the PR
  checklist for the maintainer.

## 5. Screenshots

The 2026.11.2 screenshots came from the e2e fixture server:

- Start the server with `cd e2e && pnpm e2e:serve` (port 18000, empty database). Start the web
  with the Vite command in `e2e/playwright.config.ts`, with `VITE_TUNARR_BACKEND_URI` pointed at
  the server.
- Seed it by calling `seed()` from `e2e/fixture/seed.ts` in a scratch `tsx` script, then add
  whatever demo data the feature needs through the API, such as renamed channels or a show with
  several audio languages.
- Capture with a scratch Playwright script, dark theme, 1440px wide, cropped to the feature.
- Palette-compress the PNGs if `pngquant` or `oxipng` is installed. Aim for under 50 KB each.
- Give every image alt text that says what it shows.

If a screenshot can't be taken, leave a `<!-- TODO screenshot: ... -->` comment and list it in the PR.

## 6. Verify and open the PR

```bash
pnpm exec prettier --check docs/blog/posts/next/index.md
```

Build the site with the draft visible, in a scratch copy, so the real file keeps `draft: true`:

```bash
rsync -a --exclude node_modules --exclude .git ./ <scratchpad>/site/
sed -i '/^draft: true$/d' <scratchpad>/site/docs/blog/posts/next/index.md
(cd <scratchpad>/site && uvx --from mkdocs-material --with mkdocs-glightbox mkdocs build --strict)
```

`--strict` fails on broken relative links in the post. The INFO lines about absolute links in
other pages are pre-existing and don't fail the build.

Open the PR with the `pr` skill. Title it `docs(blog): draft the <version> release post`. In the
body, list the sections and the PRs each one covers, the ErsatzTV next range if any, and a checklist:

- [ ] Any claims you couldn't confirm, one per line.
- [ ] Missing screenshots.

When the release is cut, the workflow opens the promotion PR. Nothing else is needed from this skill.
