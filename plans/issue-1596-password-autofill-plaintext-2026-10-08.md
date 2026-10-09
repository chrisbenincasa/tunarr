# Issue #1596: Jellyfin password saved as plain browser form history

> **Status (10/08/2026):** Not reproduced on Chromium 153. PR #2254 fixes the labels and adds autocomplete hints, and closes the issue on merge. Reporter asked to retest; labeled `pending response`.

## Report

- Chrome 143 on Ubuntu. Add a Jellyfin source with username and password, reveal the password, save, delete, and re-add.
- On re-add, the password appears as a plain-text autofill suggestion.
- The reporter blames the reveal toggle, which switches the input to `type="text"`.

## Code facts

- `JelllyfinServerEditDialog.tsx` and `EmbyServerEditDialog.tsx` toggle the password input between `password` and `text`. Plex does the same for its access token.
- No input in these dialogs sets `autoComplete`.
- The Username and Password inputs pass `label="Access Token"` to `OutlinedInput`, and both reveal buttons use the aria-label "toggle access token visibility".
  - The outline legend therefore says "Access Token", and screen readers announce the wrong field.

## Browser experiment

- Ran a standalone page in Playwright's full Chromium 153 (Chrome for Testing) with a fresh profile per run.
- Submitted via `fetch` and then removed the form, as Tunarr's dialog does.
- Afterward, read the `autofill` and `autocomplete` tables in the profile's `Web Data` store.

| Variant | Stored in form history |
|---------|------------------------|
| Password field, never revealed | `username` only |
| Revealed after typing | `username` only |
| Revealed before typing | `username` only |
| Revealed, with `autocomplete` set to `off`, `current-password`, or `new-password` | `username` only |
| Field is `type="text"` from page load (control) | `username` only |

- Chromium 153 never stored the password value, even in the control. It appears to exclude password-named fields from form history.
- Limits:
  - The reporter used Chrome 143, and behavior may differ by version.
  - Headless Chromium has no password manager UI. If the reporter had a saved password, Chrome's hover preview would show it in clear text inside a revealed field. That preview comes from the encrypted password store, not plain form history.

## Recommendation

- Fix the labels and aria-labels in the Jellyfin, Emby, and Plex dialogs.
- Add `autoComplete="username"` and `autoComplete="current-password"` hints.
- Reply to the reporter with the results and ask whether it still happens on a current Chrome.
