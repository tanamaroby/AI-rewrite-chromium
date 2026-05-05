// options.js

const DEFAULT_COMMANDS = [
  {
    keyword: "//re",
    label: "Rewrite",
    prompt:
      "Rewrite the following text to be clearer and more polished. Keep the same meaning and tone. Return only the rewritten text, no explanations.",
  },
  {
    keyword: "//bt",
    label: "Better",
    prompt:
      "Rewrite the following text to sound better — more professional, articulate, and compelling. Return only the rewritten text, no explanations.",
  },
  {
    keyword: "//slime",
    label: "Slime",
    prompt:
      "Rewrite the following text as if you are an enthusiastic, gooey slime character. Be playful, wobbly, and oozy in your language. Return only the rewritten text, no explanations.",
  },
];

// ─── Navigation ────────────────────────────────────────────────────────────

const navLinks = document.querySelectorAll(".nav-link");
const sections = document.querySelectorAll(".section");

navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const target = link.dataset.section;
    navLinks.forEach((l) => l.classList.remove("active"));
    sections.forEach((s) => s.classList.remove("active"));
    link.classList.add("active");
    document.getElementById(target).classList.add("active");
  });
});

// ─── API Key ────────────────────────────────────────────────────────────────

const apiKeyInput = document.getElementById("apiKeyInput");
const toggleApiKeyBtn = document.getElementById("toggleApiKey");
const saveApiKeyBtn = document.getElementById("saveApiKey");
const apiSaveFeedback = document.getElementById("apiSaveFeedback");

// Load saved key
chrome.storage.sync.get("apiKey", (data) => {
  if (data.apiKey) apiKeyInput.value = data.apiKey;
});

// Show/hide toggle
toggleApiKeyBtn.addEventListener("click", () => {
  const isPassword = apiKeyInput.type === "password";
  apiKeyInput.type = isPassword ? "text" : "password";
});

saveApiKeyBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showFeedback(apiSaveFeedback, "Please enter a key.", false);
    return;
  }
  chrome.storage.sync.set({ apiKey: key }, () => {
    showFeedback(apiSaveFeedback, "✓ Saved!", true);
  });
});

// ─── Model ──────────────────────────────────────────────────────────────────

const modelInput = document.getElementById("modelInput");
const saveModelBtn = document.getElementById("saveModel");
const modelSaveFeedback = document.getElementById("modelSaveFeedback");

const OLD_VENICE_MODEL =
  "cognitivecomputations/dolphin-mistral-24b-venice-edition:free";
const OLD_LLAMA_MODEL = "meta-llama/llama-3.3-70b-instruct:free";
const DEFAULT_MODEL = "mistralai/mistral-small-3.2-24b-instruct:free";

const RATE_LIMITED_MODELS = new Set([OLD_VENICE_MODEL, OLD_LLAMA_MODEL]);

chrome.storage.sync.get("model", (data) => {
  // Migrate away from models known to have severe free-tier rate limits
  const shouldMigrate = !data.model || RATE_LIMITED_MODELS.has(data.model);
  const current = shouldMigrate ? DEFAULT_MODEL : data.model;
  if (shouldMigrate) {
    chrome.storage.sync.set({ model: DEFAULT_MODEL });
  }
  modelInput.value = current;
});

saveModelBtn.addEventListener("click", () => {
  const model = modelInput.value.trim();
  if (!model) {
    showFeedback(modelSaveFeedback, "Model ID cannot be empty.", false);
    return;
  }
  chrome.storage.sync.set({ model }, () => {
    showFeedback(modelSaveFeedback, "✓ Saved!", true);
  });
});

// ─── Keywords ───────────────────────────────────────────────────────────────

const commandsContainer = document.getElementById("commandsContainer");
const addCommandBtn = document.getElementById("addCommand");
const saveCommandsBtn = document.getElementById("saveCommands");
const cmdSaveFeedback = document.getElementById("cmdSaveFeedback");

let commands = [];

chrome.storage.sync.get("commands", (data) => {
  commands =
    data.commands && data.commands.length
      ? data.commands
      : [...DEFAULT_COMMANDS];
  renderCommands();
});

function renderCommands() {
  commandsContainer.innerHTML = "";
  commands.forEach((cmd, i) => {
    commandsContainer.appendChild(createCommandRow(cmd, i));
  });
}

function createCommandRow(cmd, index) {
  const row = document.createElement("div");
  row.className = "command-row";
  row.dataset.index = index;

  row.innerHTML = `
    <div class="cmd-col">
      <span class="cmd-col-label">Keyword</span>
      <input
        type="text"
        class="cmd-input cmd-keyword-input"
        value="${escHtml(cmd.keyword)}"
        placeholder="//kw"
        spellcheck="false"
      />
      <span class="cmd-col-label" style="margin-top:8px;">Label</span>
      <input
        type="text"
        class="cmd-input cmd-label-input"
        value="${escHtml(cmd.label || "")}"
        placeholder="Label"
        spellcheck="false"
      />
    </div>
    <div class="cmd-col">
      <span class="cmd-col-label">Rewrite Prompt</span>
      <textarea
        class="cmd-prompt-input"
        placeholder="Instruction sent to AI. The text to rewrite will be appended as the user message."
        spellcheck="false"
      >${escHtml(cmd.prompt)}</textarea>
    </div>
    <button class="cmd-delete" title="Delete keyword" data-index="${index}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14H6L5 6"/>
        <path d="M10 11v6"/>
        <path d="M14 11v6"/>
        <path d="M9 6V4h6v2"/>
      </svg>
    </button>
  `;

  row.querySelector(".cmd-delete").addEventListener("click", () => {
    commands.splice(index, 1);
    renderCommands();
  });

  return row;
}

addCommandBtn.addEventListener("click", () => {
  commands.push({ keyword: "//", label: "", prompt: "" });
  renderCommands();
  // Focus the new keyword input
  const rows = commandsContainer.querySelectorAll(".command-row");
  const last = rows[rows.length - 1];
  last?.querySelector(".cmd-keyword-input")?.focus();
  last?.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

saveCommandsBtn.addEventListener("click", () => {
  // Collect values from DOM
  const rows = commandsContainer.querySelectorAll(".command-row");
  const updated = [];
  let hasError = false;

  rows.forEach((row) => {
    const keyword = row.querySelector(".cmd-keyword-input").value.trim();
    const label = row.querySelector(".cmd-label-input").value.trim();
    const prompt = row.querySelector(".cmd-prompt-input").value.trim();

    if (!keyword.startsWith("//")) {
      row.querySelector(".cmd-keyword-input").style.borderColor =
        "var(--error)";
      hasError = true;
    } else {
      row.querySelector(".cmd-keyword-input").style.borderColor = "";
    }

    updated.push({ keyword, label: label || keyword, prompt });
  });

  if (hasError) {
    showFeedback(cmdSaveFeedback, "Keywords must start with //", false);
    return;
  }

  commands = updated;
  chrome.storage.sync.set({ commands }, () => {
    showFeedback(cmdSaveFeedback, "✓ Saved!", true);
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function showFeedback(el, message, success) {
  el.textContent = message;
  el.className = `save-feedback visible ${success ? "ok" : "err"}`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.classList.remove("visible");
  }, 3000);
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
