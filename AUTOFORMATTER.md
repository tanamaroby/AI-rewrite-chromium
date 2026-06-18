# Autoformatter

A non-AI text formatter built into the extension. It cleans up roleplay/chat text instantly (no API calls, no latency) and wraps narration in asterisks while leaving dialogue and brackets alone. Implemented in [content.js](content.js) (`formatText()`, around [content.js:307](content.js#L307)), configured via [options.html](options.html) and [options.js](options.js).

## How it's triggered

| Shortcut | Action |
|---|---|
| `Ctrl+M` (configurable) | Format the focused input. On SpicyChat, also prepends the RPG tracker summary block if one isn't already present. |
| `Ctrl+Shift+M` (configurable) | Format without adding the tracker summary. |
| Auto-format after rewrite | If enabled, automatically runs the formatter on the result of every AI rewrite. |

A master "Enable formatter" toggle gates all of the above.

## What it does

`formatText()` runs a configurable pipeline of regex-based passes, each independently toggleable in Settings. Order matters — later passes (like asterisk wrapping) see the output of earlier ones.

### Normalisation
- **Strip existing asterisks** — removes all `*` before reformatting, for a clean slate.
- **Normalise curly quotes** — `“ ”` → `"`.
- **Normalise curly apostrophes** — `‘ ’` → `'`.
- **Normalise ellipsis** — `...` (or longer runs of dots) → `…`.
- **Collapse multiple spaces** — runs of 2+ spaces/tabs → single space.
- **Capitalise standalone `i`** — fixes the pronoun `i`/`i'd`/`i'm`/`i'll` → `I`/`I'd`/`I'm`/`I'll`.
- **Capitalise first letter inside `"quotes"`** — treats quoted text as spoken dialogue, e.g. `"oh wow"` → `"Oh wow"`.
- **Em-dash conversion** — `--` (exactly two hyphens, not `---`) → `—`.
- **Remove space before punctuation** — `hello , world` → `hello, world`.
- **Ensure space after punctuation** — `hello.she` → `hello. She` (skips decimal numbers like `3.14`).
- **Trim paragraph whitespace** — strips leading/trailing spaces on every line.
- **Normalise paragraph spacing** — collapses any run of newlines to exactly one blank line between paragraphs.
- **Capitalise sentences** — capitalises the first letter of each paragraph and after `.`/`!`/`?` (but not after `…`).

### Wrapping
- **Asterisk-wrap narration** — any text outside `"quoted dialogue"` (and outside `[bracketed]` content, if "leave brackets unwrapped" is on) gets wrapped in `*asterisks*`, the standard convention for marking actions/narration in roleplay chat. Custom delimiter pairs (e.g. `()`) can also be excluded from wrapping via the "Extra unwrapped delimiter pairs" setting.

### Roleplay-specific
- **Repair unclosed action markers** — if a line has an odd number of `*`, appends a closing `*` so wrapping doesn't break.
- **Action punctuation** — ensures `*actions*` end in sentence-ending punctuation (`. ! ? , : … —`); appends a `.` if missing. Also capitalises the start of an action that follows a sentence-ending punctuation mark.
- **Clean up OOC double-brackets** — `((out of character))` → `(out of character)`.

## Tracker summary integration (SpicyChat)

When formatting via the main shortcut (not the "no tracker" variant), the extension builds an RPG tracker summary (party status, etc.) and prepends it to the formatted text — unless the text already starts with a tracker header, in which case it's left alone.

## Settings

All toggles live in the extension's options page under the **Formatter** section, grouped into *Normalisation*, *Wrapping*, and *Roleplay*. Each setting is persisted via `chrome.storage` and read live by [content.js](content.js) on load.
