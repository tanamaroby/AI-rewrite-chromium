# GitHub Copilot Instructions

## Project overview

This is a **Chromium MV3 browser extension** that rewrites text in any web textbox using AI keyword shortcuts (e.g. `//re`, `//bt`). It calls [OpenRouter](https://openrouter.ai) for all AI inference. No build step — pure HTML/CSS/JS.

## Architecture

```
manifest.json        MV3 manifest — permissions, content scripts, service worker
background.js        Service worker — all OpenRouter API calls happen here (keeps key off content pages)
content.js           Injected into every page — watches input events, detects keyword triggers
content.css          Styles for the loading overlay and toast notifications
popup.html/css/js    Toolbar popup — shows API key status and active keyword chips
options.html/css/js  Settings page — three tabs: API Key, Keywords, Model
icons/               PNG icons at 16/32/48/128px
```

## Key conventions

- **API calls only in `background.js`** — never call OpenRouter from `content.js` (CORS + key security)
- **Messaging**: content → background via `chrome.runtime.sendMessage({ type: "REWRITE_TEXT", ... })`
- **Storage**: `chrome.storage.sync` for `apiKey`, `model`, `commands[]`
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
3. Scan for any loaded keyword at the end of element value
4. If found: show overlay, strip keyword from text, send `REWRITE_TEXT` message to background
5. Background calls OpenRouter, returns rewritten text
6. Content script replaces element value, removes overlay, shows toast

## Release process

- Bump `"version"` in `manifest.json`
- Add a new entry to `CHANGELOG.md` under `## [X.Y.Z] - YYYY-MM-DD` (Keep a Changelog format)
- Commit, tag, and push: `git tag vX.Y.Z && git push origin vX.Y.Z`
- GitHub Actions (`.github/workflows/release.yml`) automatically:
  - Extracts the matching changelog section for the tag from `CHANGELOG.md`
  - Zips the extension files
  - Creates a GitHub Release with the changelog notes + installation instructions as the body
- Users install by downloading the zip, unzipping to a permanent folder, and using "Load unpacked" in `chrome://extensions`

## Style notes

- Dark purple theme: `#0f0c1e` background, `#6c63ff` → `#a78bfa` gradient accent
- Options page has sidebar nav with three sections shown/hidden via JS (no routing library)
- Overlay uses glass-morphism: `backdrop-filter: blur`, semi-transparent dark panel
