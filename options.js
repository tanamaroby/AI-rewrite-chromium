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
const OLD_MISTRAL_FREE = "mistralai/mistral-small-3.2-24b-instruct:free"; // never existed
const DEFAULT_MODEL = "openrouter/free";

const RATE_LIMITED_MODELS = new Set([
  OLD_VENICE_MODEL,
  OLD_LLAMA_MODEL,
  OLD_MISTRAL_FREE,
]);

function updateCardSelection(selectedModel) {
  document.querySelectorAll(".model-card[data-model]").forEach((card) => {
    const pill = card.querySelector(".model-select-pill");
    if (card.dataset.model === selectedModel) {
      card.classList.add("active");
      if (pill) pill.textContent = "✓ Active";
    } else {
      card.classList.remove("active");
      if (pill) pill.textContent = "Select";
    }
  });
}

chrome.storage.sync.get("model", (data) => {
  // Migrate away from models known to have severe free-tier rate limits
  const shouldMigrate = !data.model || RATE_LIMITED_MODELS.has(data.model);
  const current = shouldMigrate ? DEFAULT_MODEL : data.model;
  if (shouldMigrate) {
    chrome.storage.sync.set({ model: DEFAULT_MODEL });
  }
  modelInput.value = current;
  updateCardSelection(current);
});

document.querySelectorAll(".model-card[data-model]").forEach((card) => {
  card.addEventListener("click", () => {
    const model = card.dataset.model;
    modelInput.value = model;
    updateCardSelection(model);
  });
});

modelInput.addEventListener("input", () => {
  updateCardSelection(modelInput.value.trim());
});

saveModelBtn.addEventListener("click", () => {
  const model = modelInput.value.trim();
  if (!model) {
    showFeedback(modelSaveFeedback, "Model ID cannot be empty.", false);
    return;
  }
  chrome.storage.sync.set({ model }, () => {
    showFeedback(modelSaveFeedback, "✓ Saved!", true);
    updateCardSelection(model);
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
// ─── SpicyChat Notes ───────────────────────────────────────────────────────────────

const spicychatNotesToggle = document.getElementById("spicychatNotesToggle");
const spicychatNotesSaveFeedback = document.getElementById(
  "spicychatNotesSaveFeedback",
);

chrome.storage.sync.get("spicychatNotesEnabled", (data) => {
  spicychatNotesToggle.checked = data.spicychatNotesEnabled !== false;
});

spicychatNotesToggle.addEventListener("change", () => {
  chrome.storage.sync.set(
    { spicychatNotesEnabled: spicychatNotesToggle.checked },
    () => {
      showFeedback(
        spicychatNotesSaveFeedback,
        "✓ Saved! Reload the SpicyChat tab to apply.",
        true,
      );
    },
  );
});

// ── Notes list ──
const scNotesCountEl = document.getElementById("sc-notes-count");
const scNotesListEl = document.getElementById("sc-notes-list");
const scNotesEmptyEl = document.getElementById("sc-notes-empty");
const scNotesRefreshBtn = document.getElementById("sc-notes-refresh");

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderNotesList(notes) {
  scNotesCountEl.textContent = notes.length;
  if (notes.length === 0) {
    scNotesEmptyEl.style.display = "";
    Array.from(scNotesListEl.children).forEach((c) => {
      if (c !== scNotesEmptyEl) c.remove();
    });
    return;
  }
  scNotesEmptyEl.style.display = "none";
  Array.from(scNotesListEl.children).forEach((c) => {
    if (c !== scNotesEmptyEl) c.remove();
  });

  for (const note of notes) {
    const words =
      note.text.trim() === "" ? 0 : note.text.trim().split(/\s+/).length;
    const chars = note.text.length;
    const lastmod = note.lastmod
      ? new Date(note.lastmod).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

    const card = document.createElement("div");
    card.className = "card";
    card.style.cssText =
      "padding: 12px 16px; display: flex; flex-direction: column; gap: 8px;";
    card.dataset.chatId = note.chatId;
    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
        <div>
          <span style="font-size:12px; font-weight:600; color:var(--text-primary);">${escapeHtml(note.chatId)}</span>
          <span style="font-size:11px; color:var(--text-muted); margin-left:10px;">${words} words · ${chars} chars · ${escapeHtml(lastmod)}</span>
        </div>
        <div style="display:flex; gap:6px; flex-shrink:0;">
          <button class="btn-ghost sc-note-edit-btn" style="font-size:11px; padding:3px 10px;" data-chat-id="${escapeHtml(note.chatId)}">Edit</button>
          <button class="btn-ghost sc-note-delete-btn" style="font-size:11px; padding:3px 10px; color:#ef4444; border-color:rgba(239,68,68,0.4);" data-chat-id="${escapeHtml(note.chatId)}">Delete</button>
        </div>
      </div>
      <div class="sc-note-editor" style="display:none;">
        <textarea class="form-input sc-note-textarea" rows="8" style="font-family:ui-monospace,monospace; font-size:12px; resize:vertical; width:100%; box-sizing:border-box;">${escapeHtml(note.text)}</textarea>
        <div style="display:flex; gap:8px; margin-top:6px;">
          <button class="btn-primary sc-note-save-btn" style="padding:6px 16px; font-size:12px;" data-chat-id="${escapeHtml(note.chatId)}">Save</button>
          <button class="btn-ghost sc-note-cancel-btn" style="font-size:12px; padding:6px 14px;" data-chat-id="${escapeHtml(note.chatId)}">Cancel</button>
          <span class="save-feedback sc-note-save-feedback" style="margin-left:4px;"></span>
        </div>
      </div>
    `;
    scNotesListEl.appendChild(card);
  }

  scNotesListEl.querySelectorAll(".sc-note-edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".card");
      const editor = card.querySelector(".sc-note-editor");
      const isOpen = editor.style.display !== "none";
      editor.style.display = isOpen ? "none" : "";
      btn.textContent = isOpen ? "Edit" : "Close";
    });
  });

  scNotesListEl.querySelectorAll(".sc-note-save-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const chatId = btn.dataset.chatId;
      const card = btn.closest(".card");
      const ta = card.querySelector(".sc-note-textarea");
      const fb = card.querySelector(".sc-note-save-feedback");
      const key = "sc_note_v1_" + chatId;
      chrome.storage.local.set(
        { [key]: { text: ta.value, lastmod: Date.now() } },
        () => {
          showFeedback(fb, "✓ Saved", true);
        },
      );
    });
  });

  scNotesListEl.querySelectorAll(".sc-note-delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const chatId = btn.dataset.chatId;
      if (!confirm(`Delete notes for chat "${chatId}"? This cannot be undone.`))
        return;
      const key = "sc_note_v1_" + chatId;
      chrome.storage.local.remove(key, () => loadSavedNotes());
    });
  });

  scNotesListEl.querySelectorAll(".sc-note-cancel-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".card");
      const editor = card.querySelector(".sc-note-editor");
      const editBtn = card.querySelector(".sc-note-edit-btn");
      editor.style.display = "none";
      editBtn.textContent = "Edit";
    });
  });
}

function loadSavedNotes() {
  chrome.storage.local.get(null, (items) => {
    const notes = [];
    for (const [key, val] of Object.entries(items)) {
      if (!key.startsWith("sc_note_v1_")) continue;
      const chatId = key.replace("sc_note_v1_", "");
      notes.push({ chatId, text: val.text || "", lastmod: val.lastmod || 0 });
    }
    notes.sort((a, b) => b.lastmod - a.lastmod);
    renderNotesList(notes);
  });
}

scNotesRefreshBtn.addEventListener("click", loadSavedNotes);
loadSavedNotes();

// ─── Formatter ─────────────────────────────────────────────────────────────────────

const formatterToggle = document.getElementById("formatterToggle");
const formatterKeywordInput = document.getElementById("formatterKeywordInput");
const saveFormatterBtn = document.getElementById("saveFormatter");
const formatterSaveFeedback = document.getElementById("formatterSaveFeedback");

chrome.storage.sync.get(["formatterEnabled", "formatterKeyword"], (data) => {
  formatterToggle.checked = data.formatterEnabled !== false;
  formatterKeywordInput.value = data.formatterKeyword || "//format";
});

saveFormatterBtn.addEventListener("click", () => {
  const kw = formatterKeywordInput.value.trim();
  if (kw && !kw.startsWith("//")) {
    formatterKeywordInput.style.borderColor = "var(--error)";
    showFeedback(formatterSaveFeedback, "Keyword must start with //", false);
    return;
  }
  formatterKeywordInput.style.borderColor = "";
  chrome.storage.sync.set(
    {
      formatterEnabled: formatterToggle.checked,
      formatterKeyword: kw || "//format",
    },
    () => {
      showFeedback(formatterSaveFeedback, "✓ Saved!", true);
    },
  );
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
