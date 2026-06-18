# AI Rewriter - Chrome Extension

AI-assisted rewriting for SpicyChat plus a local text formatter for any textbox.

## Current behavior

- AI rewrites run only on spicychat.ai
- The local formatter runs on any website
- No keyword triggers are used
- Rewrites are run from the SpicyChat drawer RP Tools tab or Ctrl+N
- Formatting runs with Ctrl+M and no-tracker formatting runs with Ctrl+Shift+M

## Features

- Rewrites presets: 5 saved presets (name + prompt), one active at a time
- Scene Context: per-chat context, location, clothes, status, dialogue style
- Persona slots: 10 saved personas with description and personality fields
- RPG session tracker drawer on SpicyChat chat pages:
   quest log, resources, abilities, party, NPCs, rumours, dice tools
- Formatter pipeline in content script (no AI call required)
- OpenRouter model selection (default openrouter/free)
- Retry with exponential backoff for API calls in the service worker

## Installation

1. Download the latest release zip from ../../releases/latest
2. Unzip to a permanent folder
3. Open chrome://extensions
4. Enable Developer mode
5. Click Load unpacked and select the folder

## Setup

1. Open extension settings
2. Add your OpenRouter API key in API Key section
3. Choose a model in Model section (default: openrouter/free)

## Usage

### On SpicyChat

- Open the right-side RPG tracker drawer
- In RP Tools, choose an active Rewrite preset
- Run rewrite from the drawer or press Ctrl+N in a focused input

### Anywhere

- Press Ctrl+M to run the local formatter
- Press Ctrl+Shift+M to format without tracker summary

## Development

No build step. Plain HTML/CSS/JS.

Core files:

- manifest.json
- background.js (OpenRouter calls)
- content.js (formatter + SpicyChat rewrite orchestration)
- spicychat-rpg-tracker-layout.js
- spicychat-rpg-tracker-sections.js
- spicychat-rpg-tracker-activity-exports.js
- spicychat-rpg-tracker-rp-tools.js
- spicychat-rpg-tracker-drawer.js
- popup.html/css/js
- options.html/css/js

## Privacy

- Extension API key is stored in chrome.storage.sync
- AI text is sent to OpenRouter only when you trigger rewrite
- No analytics/telemetry are implemented

## License

MIT
