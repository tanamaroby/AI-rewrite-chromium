# Changelog

All notable changes to AI Rewriter will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-06-14

### Changed (breaking)
- **Removed all `//` keyword triggers.** AI rewrites and the formatter are no longer triggered by typing keywords. Rewrites now run via click in the SpicyChat drawer or the `Ctrl+N` shortcut; the formatter runs via `Ctrl+M` (and `Ctrl+Shift+M` to skip the RPG tracker summary).
- **AI rewriting is now SpicyChat-only.** The local text formatter still works in any textbox on any page.

### Added
- **Rewrites presets** — five saveable rewrite presets (name + prompt), managed in the SpicyChat side drawer → RP Tools. Activate one at a time; `Ctrl+N` runs the active preset.
- **Scene Context** (per-chat) — Context (a general description of what's happening), Location, Clothes, Status, and Dialogue Style fields injected into every Rewrite on SpicyChat.
- **Persona Description + Personality** — each Persona slot now has a separate `{{user}}` **Description** (who they are) and **Personality** (how they think, speak and behave); both are injected before every Rewrite, with the description first.
- Popup now lists the saved Rewrites and highlights the active one.

### Removed
- Keyword commands system (`commands[]`, the Keywords options tab, and the popup keyword chips).
- One-Shot Rewrite, Global Style Rules, the floating format button, and the "Inject Tracker Summary on Format" toggle (tracker summary now always prepends on `Ctrl+M`).
- Legacy `commands` storage is cleaned up automatically on update.

---

## [1.0.0] - 2026-05-05

### Added
- Initial release
- Keyword shortcuts (`//re`, `//bt`, `//slime`) that trigger AI rewrites in any textbox
- Works on `<textarea>`, `<input>`, and `contenteditable` elements (Gmail, Notion, Twitter, etc.)
- Glass-morphism loading overlay with spinner while the AI is thinking
- Toast notifications showing model used, elapsed time, and success/error status
- Retry logic with exponential backoff (3 attempts, 2s base delay) — respects `Retry-After` header
- Empty response detection — retries instead of failing immediately
- Options page with three tabs: API Key, Keywords, Model
- Click-to-select model cards with accurate live pricing and comparison guide
- Model cards: `openrouter/free` (default), Hermes 3 405B (free), Cydonia 24B, Skyfall 36B, Euryale 70B
- Auto-migration away from known bad/nonexistent model IDs on options page load
- Popup showing API key status, active model pill, and keyword list with prompt previews
- GitHub Actions release workflow — tags trigger automatic zip build and GitHub Release

### Models
- Default: `openrouter/free` — auto-routes to any available free model
- Paid uncensored options: `thedrummer/cydonia-24b-v4.1`, `thedrummer/skyfall-36b-v2`, `sao10k/l3.3-euryale-70b`
