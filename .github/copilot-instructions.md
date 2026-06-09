# GitHub Copilot Instructions

## Project overview

This is a **Chromium MV3 browser extension** that rewrites text in any web textbox using AI keyword shortcuts (e.g. `//re`, `//bt`). It calls [OpenRouter](https://openrouter.ai) for all AI inference. No build step — pure HTML/CSS/JS.

## Architecture

```
── Chrome extension (load this folder in Chrome) ──────────────────────────────
manifest.json              MV3 manifest — permissions, content scripts, service worker
background.js              Service worker — all OpenRouter API calls happen here (keeps key off content pages)
content.js                 Injected into every page — handles AI rewrites, local formatter, SpicyChat RP events
content.css                Styles for loading overlay, formatter overlay, toast notifications, format button
popup.html/css/js          Toolbar popup — API key status, model pill, keyword chips, quick toggles
options.html/css/js        Settings page — sidebar nav: API Key, Keywords, Model, SpicyChat RPG Tracker, Formatter, RP Persona
spicychat-memory-drawer.js Content script injected into SpicyChat chat pages only — resizable RPG session tracker drawer
icons/                     PNG icons at 16/32/48/128px

── Mobile userscript (Safari/Userscripts app on iPhone/iPad) ──────────────────
mobile/ai-rewriter-mobile.user.js   Standalone userscript — completely separate from the extension
mobile/toolbar-preview.html         Static HTML preview — open in any browser to test toolbar UI

── Dev tooling ────────────────────────────────────────────────────────────────
deploy-mobile.sh           Bumps @version in the userscript and copies it to iCloud Drive for iPhone sync
```

> **Chrome extension isolation**: `manifest.json` only references explicitly named JS/CSS files. `mobile/` files are never loaded by the extension. The release zip also excludes them (hardcoded file list in `release.yml`).

> **API key warning**: `mobile/ai-rewriter-mobile.user.js` contains a hardcoded `API_KEY`. Never commit this file to a public repo without scrubbing the key first.

## Key conventions

- **API calls only in `background.js`** — never call OpenRouter from `content.js` (CORS + key security)
- **Messaging**: content → background via `chrome.runtime.sendMessage({ type: "REWRITE_TEXT", ... })`
- **Storage**:
  - `chrome.storage.sync`: `apiKey`, `model`, `commands[]`, all formatter settings (`fmt*`), `formatterEnabled`, `formatterKeyword`, `autoFormatAfterRewrite`, `fmtShortcut`, `rpPersonaEnabled`, `rpPersonaName`, `rpPersonaPrepend`, `rpGlobalStyle`, `spicychatNotesEnabled`
  - `chrome.storage.local`: RPG tracker data keyed as `sc_quests_v1_<chatId>`, `sc_res_v1_<chatId>`, `sc_abl_v1_<chatId>`, `sc_party_v1_<chatId>`, `sc_npc_v1_<chatId>`, `sc_rumour_v1_<chatId>`, `sc_dice_mod_v1_<chatId>`; `sc_last_rewrite` (last rewrite for undo); `sc_note_width_v1` (drawer width)
- **Retry logic**: `MAX_RETRIES = 3`, `RETRY_DELAY_MS = 2000`, exponential backoff, honors `Retry-After` header
- **Default model**: `openrouter/free` — auto-routes to any available free model
- **No build tools** — no npm, no bundler, no TypeScript. Keep it plain JS

## Models

Default is `openrouter/free`. Known bad models (rate-limited or nonexistent) tracked in `options.js`:

- `RATE_LIMITED_MODELS` Set — used for auto-migration on options page load
- `mistralai/mistral-small-3.2-24b-instruct:free` does NOT exist on OpenRouter (no free variant)
- Venice Dolphin free is severely rate-limited

## Content script pattern

1. Listen for `input` events on `textarea`, `input[type=text/search/email/url/tel]`, `contenteditable`
2. Debounce 300ms
3. Check for AI rewrite keyword (`commands[]`) — if found: show overlay, strip keyword, send `REWRITE_TEXT` to background, replace text, show toast
4. Check for formatter keyword (`//format` default) — if found: run local `formatText()`, no AI call
5. On focus, show a small format button (SVG icon) near the element; hide on blur with 200ms delay
6. `Ctrl+<fmtShortcut>` (default `Ctrl+M`) keyboard shortcut also triggers the local formatter

## Local text formatter (no AI)

Runs entirely in `content.js` — no API call. Controlled by `formatterEnabled` + individual toggles stored in sync storage:

- `fmtStripAsterisks` — removes all `*`
- `fmtNormaliseQuotes` / `fmtNormaliseApostrophes` — curly → straight
- `fmtNormaliseEllipsis` — `...` → `…`
- `fmtCollapseSpaces` — multiple spaces/tabs → single space
- `fmtCapitaliseI` — standalone `i` → `I`
- `fmtTrimLines` — trim whitespace from each line
- `fmtNormaliseNewlines` — collapse multiple blank lines to one
- `fmtCapitaliseSentences` — first letter of paragraphs and after `.!?`
- `fmtUnwrapBrackets` — wraps non-quoted, non-bracket text in `*…*`
- `fmtExtraDelimiters` — user-defined character pairs (string of even length) treated like brackets

`autoFormatAfterRewrite` — if true, runs the formatter automatically after every AI rewrite.

## SpicyChat features

Two content scripts run on `spicychat.ai`:

### `spicychat-memory-drawer.js`

- Injected on `/chat/*` pages (desktop only — skipped on touch devices)
- Resizable slide-in drawer panel (`#sc-np`) with a tab button (`#sc-np-tab`) at the right edge
- **No notes section** — replaced entirely by a full RPG session tracker
- Drawer width saved to `chrome.storage.local` as `sc_note_width_v1`
- Toggle controlled by `spicychatNotesEnabled` in sync storage
- On boot, erases legacy `sc_note_v1_<chatId>` keys automatically

#### RPG tracker sections (all per-chat, stored in `chrome.storage.local`)

| Section   | Key                   | Contents                                                     |
| --------- | --------------------- | ------------------------------------------------------------ |
| Quest Log | `sc_quests_v1_<id>`   | title, notes, state (active/done/failed), latest update text |
| Resources | `sc_res_v1_<id>`      | name, value (integer), notes                                 |
| Abilities | `sc_abl_v1_<id>`      | name, notes, current uses, max uses                          |
| Party     | `sc_party_v1_<id>`    | name, status (active/downed/dead/absent)                     |
| NPCs      | `sc_npc_v1_<id>`      | name, note, disposition (friendly/neutral/hostile)           |
| Rumours   | `sc_rumour_v1_<id>`   | text, done (bool)                                            |
| Dice Mod  | `sc_dice_mod_v1_<id>` | persistent modifier value + note label                       |

#### Activity log strip

- Fixed strip below the drawer header, max 10 entries, expands when entries exist
- Every event (add, remove, change, roll, resource adjust) auto-inserts into the last focused chat input via `sc-rp-inject` CustomEvent with `{ silent: true }` — no toast, no clipboard
- Each log entry has a `⎘` button to manually re-insert that line

#### Insert buttons (⎘)

- Every section has an "⎘ Insert" button that injects the section export into the chat input
- "⎘ Insert All" at the top injects all sections at once
- All exports are **single-line** `[Section: item | item | …]` format — safe from the asterisk formatter
- Dice roller has "⎘ Insert Last" for the most recent roll

#### Smart add-logging

All "Add" actions log **on blur** (after the user fills in the name/text), so the log contains real information rather than a generic "new item added" message.

#### Key functions

- `addLog(msg)` — pushes to `activityLog[]` (max 10), re-renders strip, injects `\n` + msg into chat input (silently)
- `flashCopyBtnLabel(btn)` — shows "✔ Inserted" for 1400ms on Insert buttons
- `bindCopyBtn(id, exportFn)` — wires an Insert button to inject the export via `sc-rp-inject`
- `export*()` functions — one per section, return single-line `[…]` string
- `exportAll()` — joins all section exports with `\n`
- `applyResOp(op)` — handles resource add/use/set, logs with before→after format
- `renderAbl()` — renders ability slots as visual Use buttons (one per max, up to 10); each click decrements and logs
- `autoResizeTextarea(el)` — auto-sizes textareas by scrollHeight

### SpicyChat RP events (handled in `content.js`)

`content.js` detects `isSpicyChat = location.hostname.includes("spicychat.ai")` and enables extra behaviours:

- **Input stats**: dispatches `sc-rp-input-stats` CustomEvent `{ chars, words }` on every input/focus
- **Rewrite undo**: listens for `sc-rp-undo` → restores pre-rewrite text, dispatches `sc-rp-undo-done`
- **Snippet inject**: listens for `sc-rp-inject { text, silent? }` → appends text to last focused input; if `silent: true`, suppresses the toast and strips a leading `\n` when the input is empty
- **One-shot rewrite**: listens for `sc-rp-run-oneshot { prompt }` → rewrites current input content with given prompt, dispatches `sc-rp-oneshot-result` and `sc-rp-rewrite-done`
- Last rewrite stored in `chrome.storage.local` as `sc_last_rewrite { before, after, label, ts }`
- `lastFocusedEl` tracks the last focused editable on SpicyChat for inject/oneshot targets

### RP Persona (SpicyChat only)

`buildPrompt(basePrompt)` in `content.js` prepends persona context to prompts when on SpicyChat:

1. If `rpPersonaEnabled` + `rpPersonaPrepend` set: prepends a character-context block (resolves `{{user}}` → `rpPersonaName`)
2. If `rpGlobalStyle` set: prepends global style rules
3. Appends the base command prompt

## Options page sections

Sidebar nav with sections shown/hidden via JS (no routing library):

1. **API Key** — save/toggle-visibility for OpenRouter key
2. **Keywords** — CRUD for `commands[]`; each command has `keyword`, `label`, `prompt`
3. **Model** — model ID input + click-to-select model cards; auto-migrates bad model IDs on load
4. **SpicyChat RPG Tracker** — enable/disable drawer; view saved RPG data per chat (counts of quests/resources/abilities etc.) with delete-all per chat
5. **Formatter** — all `fmt*` toggles, keyword, shortcut key, extra delimiters
6. **RP Persona** — persona name, prepend text, global style (SpicyChat-only persona injection)

## Popup quick toggles

Besides API key status, model pill, and keyword chips, the popup includes:

- **SpicyChat Notes** toggle (`spicychatNotesEnabled`) — controls the RPG session tracker drawer
- **Formatter** toggle (`formatterEnabled`)

## Release process

- Bump `"version"` in `manifest.json`
- Add a new entry to `CHANGELOG.md` under `## [X.Y.Z] - YYYY-MM-DD` (Keep a Changelog format)
- Commit, tag, and push: `git tag vX.Y.Z && git push origin vX.Y.Z`
- GitHub Actions (`.github/workflows/release.yml`) automatically:
  - Extracts the matching changelog section for the tag from `CHANGELOG.md`
  - Zips the extension files
  - Creates a GitHub Release with the changelog notes + installation instructions as the body
- Users install by downloading the zip, unzipping to a permanent folder, and using "Load unpacked" in `chrome://extensions`

## Mobile userscript (`mobile/ai-rewriter-mobile.user.js`)

Completely independent from the Chrome extension. Runs via the **Userscripts** app in Safari on iPhone/iPad.

- Fixed toolbar pinned to the top of the screen when any editable element is focused
- **Format** button pinned on the left (full toolbar height) — most-used action, instant/no AI call
- AI command buttons in a single scrollable row to the right of Format
- Calls OpenRouter directly via `GM.xmlHttpRequest` (no service worker needed)
- API key hardcoded as `API_KEY` constant at the top of the file
- Local `formatText()` / `wrapOutside()` functions mirror the logic in `content.js`
- `MODEL` constant at top — currently `xiaomi/mimo-v2.5`
- `isTablet` detection for iPadOS (checks `maxTouchPoints` to catch iPadOS 13+ Macintosh UA)
- Visual Viewport API used to keep toolbar pinned when the soft keyboard opens

### Deploy workflow

Run from the repo root:

```bash
./deploy-mobile.sh          # patch bump (2.0.2 → 2.0.3)
./deploy-mobile.sh minor    # minor bump (2.0.2 → 2.1.0)
./deploy-mobile.sh major    # major bump (2.0.2 → 3.0.0)
```

Bumps `@version` in `mobile/ai-rewriter-mobile.user.js`, then copies it to
`~/Library/Mobile Documents/com~apple~CloudDocs/Userscript Files/` as
`AI Rewriter — Mobile vX.Y.Z.user.js`. iCloud syncs it to iPhone automatically.

### Preview

Open `mobile/toolbar-preview.html` in any browser to interactively test the toolbar UI without a phone.

## Style notes

- Dark purple theme: `#0f0c1e` background, `#6c63ff` → `#a78bfa` gradient accent
- Options page has sidebar nav with sections shown/hidden via JS (no routing library)
- Overlay uses glass-morphism: `backdrop-filter: blur`, semi-transparent dark panel
- SpicyChat drawer uses `#0f0e1a` background with `rgba(108, 99, 255, 0.28)` border
- Mobile toolbar: deep dark `rgba(8,5,20,0.97)` base, teal (`#34d399`) for Format, violet (`#a78bfa`) for AI commands, glow `box-shadow` on active states

## Copilot behaviour rules

- **After any edit to `mobile/ai-rewriter-mobile.user.js`**, always ask: _"Do you want to deploy to iPhone? (`./deploy-mobile.sh [patch|minor|major]`)"_ before ending the response.
