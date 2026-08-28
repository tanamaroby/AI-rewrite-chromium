# Claude Code Instructions

## Project overview

This is a **Chromium MV3 browser extension** for AI-assisted rewriting and roleplay on [SpicyChat](https://spicychat.ai), plus a local text formatter that works in any textbox. AI rewrites run only on SpicyChat (via saved **Rewrites** presets or `Ctrl+N`); the formatter runs anywhere via `Ctrl+M`. It calls [OpenRouter](https://openrouter.ai) for all AI inference. No build step — pure HTML/CSS/JS.

## Architecture

```
── Chrome extension (load this folder in Chrome) ──────────────────────────────
manifest.json              MV3 manifest — permissions, content scripts, service worker
background.js              Service worker — all OpenRouter API calls happen here (keeps key off content pages)
content-utils.js           Pure utilities — formatter pipeline + rewrite prompt composition helpers
content.js                 Injected into every page — runtime orchestration; local formatter everywhere; AI Rewrites + SpicyChat RP events gated to spicychat.ai
content.css                Styles for loading overlay, formatter overlay, toast notifications
popup.html/css/js          Toolbar popup — API key status, model pill, Rewrites list, quick toggles
options.html/css/js        Settings page — sidebar nav: API Key, Model, SpicyChat RPG Tracker, Formatter
spicychat-rpg-tracker-layout.js Drawer CSS + HTML template payloads (styles/markup only)
spicychat-rpg-tracker-generators.js AI Generator section (Character/Item/Equipment) — prompt composition + result UI, no storage
spicychat-rpg-tracker-sections.js Resources/Abilities/Party/NPCs/Rumours section factories
spicychat-rpg-tracker-activity-exports.js Activity log strip + Insert/Export wiring
spicychat-rpg-tracker-rp-tools.js RP Tools tab logic (Persona, Rewrites, Scene Context, snippets, input stats, rewrite log)
spicychat-rpg-tracker-drawer.js Content script injected into SpicyChat chat pages only — resizable RPG tracker drawer + RP Tools (Persona, Rewrites, Scene Context)
icons/                     PNG icons at 16/32/48/128px

── Mobile userscript (Safari/Userscripts app on iPhone/iPad) ──────────────────
mobile/ai-rewriter-mobile.user.js   Standalone userscript — completely separate from the extension
mobile/toolbar-preview.html         Static HTML preview — open in any browser to test toolbar UI

── Dev tooling ────────────────────────────────────────────────────────────────
deploy-mobile.sh           Bumps @version in the userscript and copies it to iCloud Drive for iPhone sync
```

> **Chrome extension isolation**: `manifest.json` only references explicitly named JS/CSS files. `mobile/` files are never loaded by the extension. The release zip also excludes them (hardcoded file list in `release.yml`).

> **Mobile API key behavior**: `mobile/ai-rewriter-mobile.user.js` stores the API key in Userscripts runtime storage (`GM.setValue` / `GM.getValue`) via the toolbar settings sheet. Source should keep `DEFAULT_API_KEY = ""`.

## Key conventions

- **API calls only in `background.js`** — never call OpenRouter from `content.js` (CORS + key security)
- **Messaging**: content → background via `chrome.runtime.sendMessage({ type: "REWRITE_TEXT", ... })`
- **Storage**:
  - `chrome.storage.sync`: `apiKey`, `model`, all formatter settings (`fmt*`), `formatterEnabled`, `autoFormatAfterRewrite`, `fmtShortcut`, `fmtNoTrackerShortcut`, `rpRewrites[]` (5 × `{name,prompt}`), `rpActiveRewriteIndex`, `rpPersonas[]` (10 × `{label,name,description,personality}`), `rpActivePersonaIndex`, `spicychatNotesEnabled`, `scAbilityRestDetailedLog` (Abilities → Take Rest: off by default, logs a compact "all abilities restored" line instead of the full per-ability breakdown)
  - `chrome.storage.local`: RPG tracker data keyed as `sc_quests_v1_<chatId>`, `sc_res_v1_<chatId>`, `sc_abl_v1_<chatId>`, `sc_party_v1_<chatId>`, `sc_npc_v1_<chatId>`, `sc_rumour_v1_<chatId>`; `sc_rpctx_v1_<chatId>` (Scene Context: `{context,location,clothes,status,dialogueStyle}`); `sc_last_rewrite` (last rewrite for undo); `sc_note_width_v1` (drawer width)
- **Retry logic**: `MAX_RETRIES = 3`, `RETRY_DELAY_MS = 2000`, exponential backoff, honors `Retry-After` header
- **REWRITE_TEXT** accepts an optional `maxTokens` (defaults to 2048 in `background.js`'s `handleRewrite`); the RPG tracker's AI Generator passes a smaller cap (150) to keep generated character/item/equipment blurbs short
- **Runtime diagnostics** (`background.js`): in-memory counters/events for requests, retries, timeouts, rate limits, etc., exposed via runtime messages: `GET_RUNTIME_DIAGNOSTICS` and `RESET_RUNTIME_DIAGNOSTICS`
- **Default model**: `openrouter/free` — auto-routes to any available free model
- **No build tools** — no npm, no bundler, no TypeScript. Keep it plain JS

## Models

Default is `openrouter/free`. Known bad models (rate-limited or nonexistent) tracked in `options.js`:

- `RATE_LIMITED_MODELS` Set — used for auto-migration on options page load
- `mistralai/mistral-small-3.2-24b-instruct:free` does NOT exist on OpenRouter (no free variant)
- Venice Dolphin free is severely rate-limited

## Content script pattern

The local formatter works on every page; AI Rewrites and RP behaviours are gated by `isSpicyChat`.

1. On `input`/`focus`, on SpicyChat only, dispatch `sc-rp-input-stats` for the drawer
2. `Ctrl+<fmtShortcut>` (default `Ctrl+M`) runs the local formatter on the focused input; on SpicyChat it also prepends the RPG tracker summary
3. `Ctrl+Shift+<fmtNoTrackerShortcut>` runs the formatter but never prepends the tracker summary
4. `Ctrl+<REWRITE_SHORTCUT_KEY>` (default `Ctrl+N`) runs the active Rewrite preset (`rpActiveRewriteIndex`) on the focused SpicyChat input
5. There are no keyword triggers and no floating format button — all actions are clicks (in the drawer) or keyboard shortcuts

## Local text formatter (no AI)

Pure formatter logic lives in `content-utils.js` (`formatText(text, opts)`) and is called from `content.js` (no API call). Controlled by `formatterEnabled` + individual toggles stored in sync storage:

- `fmtStripAsterisks` — removes all `*`
- `fmtNormaliseQuotes` / `fmtNormaliseApostrophes` — curly → straight
- `fmtNormaliseEllipsis` — `...` → `…`
- `fmtCollapseSpaces` — multiple spaces/tabs → single space
- `fmtCapitaliseI` — standalone `i` → `I`
- `fmtTrimLines` — trim whitespace from each line
- `fmtNormaliseNewlines` — collapse multiple blank lines to one
- `fmtCapitaliseSentences` — first letter of paragraphs and after `.!?`
- `fmtUnwrapBrackets` — wraps non-quoted, non-bracket text in `*…*`
- `fmtUnwrapParens` — leaves `(parenthetical)` text unwrapped, same mechanism as `fmtUnwrapBrackets`; keeps Thoughts and OOC asides from being swallowed into an `*action*` wrap
- `fmtPreserveLists` — leaves `- item` / `1. item` lines unwrapped and un-spaced
- `fmtPreserveBlockquotes` — leaves `> quoted` lines unwrapped and un-spaced
- `fmtPreserveSpeakerTags` — leaves `**Name:** message` lines untouched: asterisks in the `**Name:**` tag survive `fmtStripAsterisks`, the line is skipped by the auto-wrap-in-asterisks pass, and paragraph-spacing won't insert blank lines between consecutive tagged lines
- `fmtPreserveSeparator` — leaves a standalone `---` line (3+ hyphens, nothing else) unwrapped in asterisks — a scene-break divider, not prose to italicize
- `fmtPreserveBold` — protects any `**bold**` pair, even mid-sentence (not just whole speaker-tag lines): `fmtStripAsterisks` skips over it (`stripAsterisksPreservingBold`), and the auto-wrap-in-asterisks pass wraps only the plain-text runs around it instead of consuming it (`wrapPreservingBold`, both in `content-utils.js`) — deliberately *not* handled via the same whole-text pattern-extraction as `fmtUnwrapBrackets`/`fmtUnwrapParens`, since pulling `**bold**` out at that stage would strip a leading `**Name:**` off a speaker-tag line before `fmtPreserveSpeakerTags` ever sees the full line. `fmtActionPunctuation`'s regex also uses a lookaround so it never reaches into a bold pair and corrupts it with a stray period
- `fmtExtraDelimiters` — user-defined character pairs (string of even length) treated like brackets

`autoFormatAfterRewrite` — if true, runs the formatter automatically after every AI Rewrite.

## Rewrites & Scene Context (SpicyChat AI)

AI Rewrites are SpicyChat-only and orchestrated in `content.js`; rewrite prompt composition is handled by `content-utils.js`:

- **Rewrites presets** — `rpRewrites[]` (5 slots of `{name,prompt}`) + `rpActiveRewriteIndex`, managed in the drawer's RP Tools tab. `runRewrite(index)` validates the preset/focus/non-empty input, builds the prompt, sends `REWRITE_TEXT`, optionally auto-formats, stores `sc_last_rewrite`, and dispatches `sc-rp-rewrite-done` + `sc-rp-rewrite-result`.
- **Scene Context** — `getSceneContext()` reads `sc_rpctx_v1_<chatId>` → `{context,location,clothes,status,dialogueStyle}` (per-chat).
- `composeRewritePrompt({ presetPrompt, persona, sceneContext })` composes (joined by blank lines): persona block (name + description + personality, `{{user}}`→name) → current-situation block (context) → scene block (location/clothes/status) → dialogue-style block → the preset prompt.

## SpicyChat features

Two content scripts run on `spicychat.ai`:

### `spicychat-rpg-tracker-drawer.js`

- Injected on `/chat/*` pages (desktop only — skipped on touch devices)
- Resizable slide-in drawer panel (`#sc-np`) with a tab button (`#sc-np-tab`) at the right edge
- **No notes section** — replaced entirely by a full RPG session tracker
- Drawer width saved to `chrome.storage.local` as `sc_note_width_v1`
- Toggle controlled by `spicychatNotesEnabled` in sync storage
- On boot, erases legacy `sc_note_v1_<chatId>` keys automatically

#### Drawer module map

- `spicychat-rpg-tracker-layout.js`: visual shell only (styles + markup templates)
- `spicychat-rpg-tracker-generators.js`: AI Generator section (`window.SCRPGTrackerGenerators.createGeneratorSection`) — Character/Item/Equipment type pills + optional name/idea and style/flavor inputs, calls the AI via `sc-rp-run-generate`/`sc-rp-generate-result`, no storage
- `spicychat-rpg-tracker-sections.js`: tracker section logic for Resources/Abilities/Party/NPCs/Rumours
- `spicychat-rpg-tracker-activity-exports.js`: activity log behavior and Insert/Export formatting
- `spicychat-rpg-tracker-rp-tools.js`: RP tools behavior (persona, rewrites, scene context, snippets, rewrite telemetry)
- `spicychat-rpg-tracker-drawer.js`: orchestrator only (boot, wiring, quest logic, resize, tab state)

#### Change-routing rule (important)

- When asked to modify tracker behavior, edit only the file that owns that behavior.
- Do not implement unrelated edits in `spicychat-rpg-tracker-drawer.js` if a dedicated module already exists.
- Keep storage-key changes scoped to the specific section/module and preserve existing key names unless migration is explicitly requested.

#### RPG tracker sections (all per-chat, stored in `chrome.storage.local`)

| Section   | Key                   | Contents                                                     |
| --------- | --------------------- | ------------------------------------------------------------ |
| Quest Log | `sc_quests_v1_<id>`   | title, notes, state (active/done/failed), latest update text |
| Resources | `sc_res_v1_<id>`      | name, value (integer), notes                                 |
| Abilities | `sc_abl_v1_<id>`      | name, notes, current uses, max uses                          |
| Party     | `sc_party_v1_<id>`    | name, status (default Healthy; supports freeform values)     |
| NPCs      | `sc_npc_v1_<id>`      | name, note, disposition (friendly/neutral/hostile)           |
| Rumours   | `sc_rumour_v1_<id>`   | text, done (bool)                                            |

#### Quick Thought & System Message (Quest Log tab, between Export All and AI Generator — not persisted)

- **Thoughts** — free-text input + "⎘ Insert" wired in `spicychat-rpg-tracker-drawer.js`, inserts `(text)` via `addLog`. Deliberately round brackets, not `[square brackets]`, so inner-monologue asides never collide with the System Message format below. `fmtUnwrapParens` (in `content-utils.js`) keeps the autoformatter from wrapping `(…)` in `*…*`; the "Thought Parentheses" Style toggle (`scThoughtStyle`) renders a standalone `(thought)` line in rendered chat messages as an italic bubble (see `.ai-thought-bubble` in `content.css`) — only when the parenthetical is alone on its own line, never mid-sentence.
- **System Message** — category `<select>` (Scene / Time Skip / Status / Event / Combat / Note) + free-text input + "⎘ Insert", also wired in `spicychat-rpg-tracker-drawer.js`, inserts `[Category: text]` — the `[square bracket]` format Thoughts used to share. Already covered by the existing "Bracket Emphasis" Style feature (`scBracketEmphasis`), same as every other `[…]` export.

#### AI Generator (Quest Log tab, directly under System Message — not persisted)

- Six type pills — Character / Location / Item / Equipment / Creature / Faction — wrapping pill-chip row (same visual language as RP Tools' snippet chips, scales to more types without redesign) plus two optional free-text inputs: a name/idea seed and a style/flavor tag (e.g. "elven", "dwarvish", "German-sounding", any free text)
- "✨ Generate" dispatches `sc-rp-run-generate` with a type-specific system prompt (from `SYSTEM_PROMPTS` in `spicychat-rpg-tracker-generators.js`) instructing the model to reply with one line, `Name — description`, description capped at 2 sentences, no markdown
- Result renders in a card with "⎘ Insert" (formats as `[Character: …]` / `[Location: …]` / `[Item: …]` / `[Equipment: …]` / `[Creature: …]` / `[Faction: …]`, single-line bracket format like other sections) and "↻ Regenerate" (re-rolls with the same type/seed/flavor)
- Ephemeral — no `chrome.storage` key; state resets when the drawer/page reloads

#### Activity log strip

- Fixed strip below the drawer header, max 10 entries, expands when entries exist
- Every event (add, remove, change, resource adjust) auto-inserts into the last focused chat input via `sc-rp-inject` CustomEvent with `{ silent: true }` — no toast, no clipboard
- Each log entry has a `⎘` button to manually re-insert that line

#### Insert buttons (⎘)

- Every section has an "⎘ Insert" button that injects the section export into the chat input
- "⎘ Insert All" at the top injects all sections at once
- All exports are **single-line** `[Section: item | item | …]` format — safe from the asterisk formatter

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
- **One-shot/preset rewrite**: listens for `sc-rp-run-rewrite { index }` → runs that Rewrite preset on the current input, dispatches `sc-rp-rewrite-result` and `sc-rp-rewrite-done`
- **AI Generator**: listens for `sc-rp-run-generate { prompt, text, maxTokens }` (dispatched by the drawer's Generator section) → calls `REWRITE_TEXT` directly (no focused input required), dispatches `sc-rp-generate-result { ok, text, model, error }`
- Last rewrite stored in `chrome.storage.local` as `sc_last_rewrite { before, after, label, ts }`
- `lastFocusedEl` tracks the last focused editable on SpicyChat for inject/rewrite targets

### RP Persona (SpicyChat only)

`composeRewritePrompt(...)` in `content-utils.js` prepends persona + scene context when on SpicyChat:

1. If the active persona (`rpActivePersonaIndex` of `rpPersonas[]`) has a `description` or `personality`: prepends a character-context block (resolves `{{user}}` → the persona `name`), description first then personality
2. Prepends the current-situation block (`context`), the Scene Context block (location, clothes, status) and a dialogue-style block when those fields are set
3. Appends the active Rewrite preset prompt

## Options page sections

Sidebar nav with sections shown/hidden via JS (no routing library):

1. **API Key** — save/toggle-visibility for OpenRouter key
2. **Model** — model ID input + click-to-select model cards; auto-migrates bad model IDs on load
3. **SpicyChat RPG Tracker** — enable/disable drawer; view saved RPG data per chat (counts of quests/resources/abilities etc.) with delete-all per chat; **RP Persona** lives in this section (10 slots, `{label,name,description,personality}`, `{{user}}` resolves to the persona name); also Export Config for Mobile + Export/Import Personas
4. **Formatter** — all `fmt*` toggles, format shortcut, no-tracker shortcut, extra delimiters

> Rewrites presets and Scene Context are managed in the **SpicyChat side drawer → RP Tools**, not on the options page.

## Popup quick toggles

Besides API key status and model pill, the popup lists the saved **Rewrites** (names, with the active one highlighted) and includes:

- **SpicyChat RPG Tracker** toggle (`spicychatNotesEnabled`, legacy key name) — controls the RPG session tracker drawer
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
- API key stored in Userscripts runtime storage and managed via toolbar Settings (`GM.setValue` / `GM.getValue`)
- Local formatter logic is implemented in userscript and tracks extension formatter behavior
- `MODEL` constant at top — currently `google/gemini-3.1-flash-lite`
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

## Claude behaviour rules

- **After any edit to `mobile/ai-rewriter-mobile.user.js`**, always ask: _"Do you want to deploy to iPhone? (`./deploy-mobile.sh [patch|minor|major]`)"_ before ending the response.
- For RPG tracker changes, route edits to the most relevant module first:
  - Layout/markup: `spicychat-rpg-tracker-layout.js`
  - Resources/Abilities/Party/NPCs/Rumours: `spicychat-rpg-tracker-sections.js`
  - Activity log and Insert/Export actions: `spicychat-rpg-tracker-activity-exports.js`
  - RP tools tab (Persona/Rewrites/Scene Context/Snippets/Last Log): `spicychat-rpg-tracker-rp-tools.js`
  - Core orchestration/quest/resize/lifecycle: `spicychat-rpg-tracker-drawer.js`
