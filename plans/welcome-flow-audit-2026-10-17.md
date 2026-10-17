# Welcome Flow Audit

> **Status (10/17/2026):** Audit done against `origin/main` @ `5ee30f5f9`. Option B chosen and implemented on branch `feat/welcome-checklist`, with a Skip Setup button. PR open against `main`.

## Scope

| File                                                  | Role                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| `web/src/routes/index.tsx`                            | Redirects `/` to `/welcome` while `isFreshSettings` is true  |
| `web/src/routes/welcome.tsx`                          | Route shell                                                  |
| `web/src/pages/welcome/WelcomePage.tsx`               | Three-step stepper: Connect Sources, Install FFMPEG, All Set |
| `web/src/components/settings/ConnectMediaSources.tsx` | Source table shown in step 1                                 |
| `web/src/store/themeEditor/{store,actions}.ts`        | `showWelcome` flag, persisted to localStorage                |
| `web/src/hooks/useNavItems.tsx`                       | Shows the Welcome nav item when `showWelcome` is true        |
| `server/src/db/SettingsDBFactory.ts`                  | Sets `migration.isFreshSettings` on every boot               |
| `docs/getting-started/setup.md`                       | User docs and screenshots for the flow                       |

The page has had no structural change since 2024. Later commits only touched i18n, formatting, and the enabled-library warning (#2286).

## Findings

### Flow logic

1. **First-run detection lasts one server process.** `SettingsDBFactory` sets `isFreshSettings` to whether `settings.json` existed at boot. The flag stays true for the whole first run and turns false on the first restart.
2. **Finish does not stick.** `/` re-reads `isFreshSettings` on every load and redirects to `/welcome`. A user who clicks Finish and then the logo or Guide root lands back on the welcome page until the server restarts.
3. **Unfinished setup is forgotten.** After a restart, `/` calls `setShowWelcome(false)`. A user who never added a source loses the page and the nav item, and lands on an empty guide.
4. **The nav item is a toggle.** `updateShowWelcomeState` flips `showWelcome` rather than clearing it. `resetShowWelcomeState` has no callers.
5. **Two sources of truth.** The server flag and the localStorage flag disagree across browsers and restarts. Neither records that onboarding finished.

### Content

6. **Copy is stale.** Step 1 says "Plex and Jellyfin are currently supported." Emby and local media are also supported.
7. **Wrong icons.** `ConnectMediaSources` shows the Jellyfin logo for every non-Plex source, including Emby and local.
8. **FFmpeg step checks presence only.** It passes any version string. `FfmpegVersionHealthCheck` already enforces the 6.1 minimum and surfaces on the Status page. Docker images ship FFmpeg, so most users see a step with nothing to do.
9. **"All Set!" carries no content.** It is a click-through screen.
10. **The gate is too weak.** Next requires a source but not an enabled library. A source with no enabled libraries only gets a warning, then Finish drops the user into `/channels/new` with nothing to add.
11. **No library scan state.** Finish sends users to build a channel before their first scan completes, so the program picker can be empty.
12. **Missing next steps.** Nothing points to client setup (M3U, XMLTV, HDHomeRun), which is where most new users get stuck.

### Docs and tests

13. `docs/getting-started/setup.md` describes the three steps and uses screenshots (`add-media-source.png`, `welcome_page_ffmpeg_installed.png`, `setup-finish.png`) that predate the library warning.
14. The e2e sweep visits `/` and `/welcome` (`e2e/tests/routes.ts:32`, `:53`) but asserts nothing about the redirect. The fixture is rebuilt each run, so the server likely boots with `isFreshSettings` true and `/` likely renders the welcome page instead of the guide. Unverified; confirm with a run.

### Related plan

`~/Code/plans/tunarr/onboarding-idiot-proof-setup-and-hw-accel.md` (not started) adds a hardware-acceleration step to `WelcomePage.tsx` and an IPTV client-setup section to the Status page. Either option below changes where that work lands.

## Options

### A. Remove

- Delete the route, page, `showWelcome` store field, actions, and nav item.
- `/` always shows the guide.
- Add empty states that link to Media Sources, on the guide and the channels list, when no source or channel exists.
- Rely on existing health checks for FFmpeg.
- Update `setup.md` to describe adding a source from Settings.

| Pro                         | Con                                        |
| --------------------------- | ------------------------------------------ |
| Least code to own           | No guided first run                        |
| Removes the broken redirect | Empty states must cover every landing page |
| No new server state         | The onboarding plan needs a new home       |

### B. Update (recommended)

- Replace the stepper with one checklist page driven by real state:
  - Media source connected, with at least one enabled library
  - First library scan finished
  - FFmpeg passes `FfmpegVersionHealthCheck` (shown as a check, not a step)
  - First channel created
  - Client setup links (M3U, XMLTV, HDHomeRun)
- Add a server-side `migration.onboardingComplete` flag, set by a Finish or Dismiss action.
- `/` redirects to `/welcome` only while that flag is false. Drop `isFreshSettings` from this path.
- At boot, an install with an existing `settings.json` and no flag gets `onboardingComplete: true`. A new install gets `false`.
- A Skip Setup button sets the flag at any time.
- Show the nav item while the flag is false. Drop the localStorage flag.
- Fix the source copy and icons.
- Refresh `setup.md` and its screenshots, and add an e2e case for the fresh-install redirect.

| Pro                                | Con                                 |
| ---------------------------------- | ----------------------------------- |
| Fixes every flow bug at the source | One new settings field and endpoint |
| Gives the onboarding plan a home   | More UI to keep current             |
| Existing installs never see it     | Screenshots need a refresh          |

## Recommendation

Option B. A new user cannot do anything until a source has an enabled, scanned library, so a guided path earns its keep. The current page fails because of its state handling, not its existence. The checklist shape also stays correct as steps change, because each item reads live state instead of advancing a stepper.
