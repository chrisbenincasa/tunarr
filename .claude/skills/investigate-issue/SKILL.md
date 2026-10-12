---
name: investigate-issue
description: Investigate a Tunarr GitHub issue end to end and write up the verdict. Reads the issue and every comment, checks whether main or a recent release already fixed it, reproduces it with the right instrument (stream-repro for playback and time-slot schedules, the e2e Playwright suite for web UI, a focused Vitest test for server or shared logic), traces the root cause, and writes a dated report to plans/investigations/ with a draft reply for the issue. Use this whenever the user points at a Tunarr issue number or URL and asks whether it is real, still happening, reproducible, already fixed, implemented, or what causes it, including terse asks like "look into #1983", "is 1639 still a bug?", "diagnose 1951", or "the author responded on 2043". Not for implementing a fix the user has already scoped (use the normal worktree and PR flow), and not for label bookkeeping across many issues (use triage).
---

# Investigate issue

Most Tunarr issues arrive as a user's description of a symptom on an old version. The useful answer
is a verdict the maintainer can act on: real or not, still present on `main` or not, why it happens,
and what to tell the reporter. This skill gets to that verdict with evidence rather than code reading
alone, and leaves a report that the next session can pick up.

## 1. Read the whole thread

```bash
gh issue view <n> --repo chrisbenincasa/tunarr --comments
```

Read every comment, not only the opening post. Reporters often add the decisive detail later: a log,
a version, a correction of the original claim. Note:

- The reporter's version, media source (Plex, Jellyfin, Emby, local), platform, and stream mode.
- The exact symptom in their words, and any logs or screenshots.
- Earlier maintainer analysis in the thread. If the maintainer already posted a theory, test that
  theory first and say plainly whether it holds.
- Any existing report in `plans/investigations/issue-<n>-*.md`. If one exists, this is a follow-up. Read it, then
  update it in place rather than starting a second file.

## 2. Check whether it is already fixed

A large share of old issues are fixed by later work, so check this before reproducing anything.

```bash
git fetch -q origin
git log origin/main --oneline -i --grep '#<n>' --grep '<keyword>'
gh pr list --repo chrisbenincasa/tunarr --state all --search '<n> in:body' --json number,title,state,mergedAt
git tag --contains <sha> | head -3      # first release that shipped a fix
```

Search by issue number and by the subsystem's keywords, since fixes often don't cite the issue.
Compare the reporter's version against the first release that contains each candidate fix. Releases
use CalVer (`vYYYY.M.PATCH`), and older ones use `v1.x`. If a fix exists, the job becomes confirming
it on `main` in step 3, not root-causing from scratch.

## 3. Reproduce with the right instrument

Pick the instrument by where the symptom shows up. A reproduction you can rerun is what makes the
verdict trustworthy, and it doubles as the check that a later fix worked.

| Symptom | Instrument |
|---|---|
| Playback: tracks, A/V sync, stalls, transitions, hardware accel, codecs | `stream-repro` skill |
| Time-slot schedules: start times, guide entries, redirect or custom-show slots | `stream-repro --schedule FILE --seconds 0` |
| Web UI: a page errors, renders wrong, or a form misbehaves | e2e Playwright suite in `e2e/` (see CLAUDE.md) |
| Server or shared logic: scheduling math, canonicalization, API validation | A focused Vitest test next to the code |
| Depends on the reporter's data or hardware | Say so and stop at the closest synthetic approximation |

Do the work in a worktree off `origin/main`, never in the main checkout:

```bash
git worktree add -b investigate/<n> .claude/worktrees/investigate-<n> origin/main
```

If the `main` result is ambiguous, rerun on the reporter's version in a detached worktree
(`git worktree add .claude/worktrees/issue-<n>-v<version> v<version>`). That separates "fixed since" from "never reproduced". If it does not
reproduce, record exactly what you ran, so the reporter can say what differs on their side.

## 4. Find the root cause

Trace from the reproduced symptom to the code. Cite `path:line` on `origin/main`. Distinguish what you
verified (ran it, saw it) from what you inferred (read the code). When the cause is a design gap
rather than a defect, say so. Feature-request issues get a feasibility estimate instead: which files
change, roughly how big the change is, and what is already in place.

## 5. Write the report

Write `plans/investigations/issue-<n>-<slug>-<YYYY-MM-DD>.md` in the worktree. Reports reach `main` through a PR,
either with the fix or batched with other investigations. Follow the house format:

```markdown
# Issue #<n>: <one-line description of the symptom>

> **Status (MM/DD/YYYY):** <verdict>. <evidence in one clause>. Next step: <action>.

## Report
- Version, source, platform, and the symptom as reported.

## Verdict
- Real / not reproduced / already fixed in <version> (#<pr>) / working as intended.

## Root cause
- What happens and why, with `path:line` citations.

## Evidence
- The commands you ran and what they showed.

## Draft reply
<the comment you would post, written to the reporter>
```

Keep it short. The sample reports in `plans/investigations/` run 30 to 45 lines. Use only the sections
the case needs. A reply to an already-fixed issue needs no root-cause section.

## 6. Hand back, don't act

End with the verdict, the report path, and the proposed next step. Do not post comments, change
labels, or close the issue on your own, because those are visible to the reporter. Offer them
instead, with the exact text. The labels that usually fit are `pending response` (asked the reporter
to retest or add detail), `info needed`, `intended-behavior`, `workaround`, and `user-issue`.

If the user then asks for a fix, keep working in the same worktree and follow the normal PR flow.
