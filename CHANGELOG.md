# Changelog

All notable changes to AI Rewriter will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
