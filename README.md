# AI Rewriter — Chrome Extension

Rewrite text in **any textbox** on any website using AI. Type a keyword shortcut at the end of your text and the extension replaces it with a rewritten version powered by [OpenRouter](https://openrouter.ai).

No Chrome Web Store required. Load it directly in Chrome in under a minute.

---

## Features

- **Keyword shortcuts** — type `//re`, `//bt`, `//slime` (or any custom trigger) at the end of your text
- **Works everywhere** — `<textarea>`, `<input>`, and `contenteditable` elements (Gmail, Notion, Twitter, etc.)
- **Fully customizable** — add, edit, or remove keywords and their AI prompts in the options page
- **Any OpenRouter model** — defaults to `openrouter/free` (auto-routes to whichever free model is available), or set a paid model like `thedrummer/cydonia-24b-v4.1` for uncensored rewrites
- **Loading overlay** — glass-morphism spinner while the AI is thinking
- **Retry with backoff** — automatically retries up to 3× on transient errors

---

## Installation

### One-time setup

1. **[Download the latest release zip](../../releases/latest)** (`ai-rewriter-vX.X.X.zip`)
2. Unzip it to a **permanent location** — Chrome loads the extension live from this folder, so don't delete or move it later
   ```
   ~/Extensions/ai-rewriter/
   ```
3. Open Chrome and go to `chrome://extensions`
4. Enable **Developer mode** (toggle in the top-right corner)
5. Click **Load unpacked** → select the unzipped folder
6. The AI Rewriter icon appears in your toolbar

### Configure your API key

1. Click the extension icon → **Open Settings** (or right-click → *Options*)
2. Go to the **API Key** tab
3. Get a free key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) (no credit card required for free models)
4. Paste the key and click **Save API Key**

---

## Usage

Type your text in any textbox, then append a keyword shortcut at the very end:

| You type | Result |
|---|---|
| `My email draft here //re` | Rewrites the text professionally |
| `Rough notes //bt` | Makes it better / more polished |
| `Story intro //slime` | Rewrites in a slime-character voice |

The keyword and original text are replaced by the AI output in place.

### Default shortcuts

| Keyword | Prompt |
|---|---|
| `//re` | Rewrite this text to be clear, concise, and professional |
| `//bt` | Make this text better — improve flow, clarity, and tone |
| `//slime` | Rewrite this as a cheerful slime character from an RPG |

All shortcuts are editable in **Options → Keywords**.

---

## Models

The default model is `openrouter/free`, which automatically routes to whatever free model is available at the time of your request — no rate limit headaches.

### Recommended alternatives

| Model | Cost | Notes |
|---|---|---|
| `openrouter/free` | Free | Auto-routes to any available free model. **Default.** |
| `google/gemma-3-27b-it:free` | Free | Solid quality, unmoderated |
| `google/gemma-4-31b-it:free` | Free | Larger, 262K context |
| `thedrummer/cydonia-24b-v4.1` | ~$0.30/M in, $0.50/M out | Uncensored, no safety filters, Mistral Small 3.2 base. ~$1 = 7,000 rewrites |

Change the model in **Options → Model**.

---

## Updating

When a new release is available:

1. Download the new zip from [Releases](../../releases)
2. Unzip **into the same folder** (overwrite files)
3. Go to `chrome://extensions` → click the **↻ reload** button on the AI Rewriter card

---

## Development

No build step. Pure HTML/CSS/JS — edit and reload.

```
ai-rewriter/
├── manifest.json       # MV3 manifest
├── background.js       # Service worker — handles OpenRouter API calls
├── content.js          # Injected into every page — detects keywords, shows overlay
├── content.css         # Overlay + toast styles
├── popup.html/css/js   # Toolbar popup
├── options.html/css/js # Settings page (API key, keywords, model)
└── icons/              # PNG icons (16, 32, 48, 128)
```

To release a new version:

1. Bump `"version"` in `manifest.json`
2. Commit and push
3. Create a git tag: `git tag v1.1.0 && git push origin v1.1.0`
4. GitHub Actions builds the zip and creates the release automatically

---

## Privacy

- Your API key is stored locally in `chrome.storage.sync` (synced to your Google account, never sent anywhere except OpenRouter)
- Text is sent to [OpenRouter](https://openrouter.ai) only when you trigger a rewrite
- No analytics, no telemetry

---

## License

MIT
