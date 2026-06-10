// options.js

const DEFAULT_COMMANDS = [
  {
    keyword: "//re",
    label: "Rewrite",
    prompt:
      "Rewrite the text. Improve clarity, flow, and word choice—keep it simple and natural. Preserve all meaning, tone, and character voices. Do not add plot, characters, or events. Return only the rewritten text.",
  },
];

// ─── Sidebar storage meter ────────────────────────────────────────────────────

(function updateStorageMeter() {
  const detail = document.getElementById("storageDetail");
  const bar = document.getElementById("storageBarFill");
  const sub = document.getElementById("storageSubLabel");

  // chrome.storage.sync quota: 102,400 bytes total
  const SYNC_QUOTA = chrome.storage.sync.QUOTA_BYTES || 102400;
  // chrome.storage.local quota: 10,485,760 bytes (10 MB)
  const LOCAL_QUOTA = chrome.storage.local.QUOTA_BYTES || 10485760;

  function fmt(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  Promise.all([
    new Promise((res) =>
      chrome.storage.sync.getBytesInUse(null, (b) => res(b)),
    ),
    new Promise((res) =>
      chrome.storage.local.getBytesInUse(null, (b) => res(b)),
    ),
  ]).then(([syncUsed, localUsed]) => {
    const totalUsed = syncUsed + localUsed;
    const totalQuota = SYNC_QUOTA + LOCAL_QUOTA;
    const pct = Math.min(100, (totalUsed / totalQuota) * 100);

    detail.textContent = `${fmt(totalUsed)} / ${fmt(totalQuota)}`;
    bar.style.width = pct.toFixed(1) + "%";
    bar.classList.remove("warn", "danger");
    if (pct >= 80) bar.classList.add("danger");
    else if (pct >= 50) bar.classList.add("warn");

    const left = totalQuota - totalUsed;
    sub.textContent = `${fmt(left)} free  ·  sync ${fmt(syncUsed)}  ·  local ${fmt(localUsed)}`;
  });
})();

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

// ── RPG data list ──
const scNotesCountEl = document.getElementById("sc-notes-count");
const scNotesListEl = document.getElementById("sc-notes-list");
const scNotesEmptyEl = document.getElementById("sc-notes-empty");
const scNotesRefreshBtn = document.getElementById("sc-notes-refresh");

const RPG_PREFIXES = [
  { key: "sc_quests_v1_", label: "Quests" },
  { key: "sc_inv_v1_", label: "Inventory" },
  { key: "sc_res_v1_", label: "Resources" },
  { key: "sc_abl_v1_", label: "Abilities" },
  { key: "sc_party_v1_", label: "Party" },
  { key: "sc_npc_v1_", label: "NPCs" },
  { key: "sc_rumour_v1_", label: "Rumours" },
];

function countItems(val) {
  return Array.isArray(val) ? val.length : 0;
}

function renderNotesList(chats) {
  scNotesCountEl.textContent = chats.length;
  if (chats.length === 0) {
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

  for (const chat of chats) {
    const summaryParts = RPG_PREFIXES.map(({ label }) => {
      const n = chat.counts[label];
      return n ? `${n} ${label}` : null;
    }).filter(Boolean);
    const summary = summaryParts.length ? summaryParts.join(" · ") : "Empty";

    const card = document.createElement("div");
    card.className = "card";
    card.style.cssText =
      "padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px;";
    card.innerHTML = `
      <div style="min-width:0;">
        <div style="font-size:12px; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escHtml(chat.chatId)}</div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:3px;">${escHtml(summary)}</div>
      </div>
      <div style="display:flex; gap:6px; flex-shrink:0;">
        <button class="btn-ghost sc-rpg-export-btn" style="font-size:11px; padding:3px 10px;" data-chat-id="${escHtml(chat.chatId)}">Export</button>
        <button class="btn-ghost sc-rpg-delete-btn" style="font-size:11px; padding:3px 10px; color:#ef4444; border-color:rgba(239,68,68,0.4);" data-chat-id="${escHtml(chat.chatId)}">Delete all</button>
      </div>
    `;
    scNotesListEl.appendChild(card);
  }

  scNotesListEl.querySelectorAll(".sc-rpg-export-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const chatId = btn.dataset.chatId;
      const keys = [
        `sc_quests_v1_${chatId}`,
        `sc_res_v1_${chatId}`,
        `sc_abl_v1_${chatId}`,
        `sc_party_v1_${chatId}`,
        `sc_npc_v1_${chatId}`,
        `sc_rumour_v1_${chatId}`,
        `sc_dice_mod_v1_${chatId}`,
      ];
      chrome.storage.local.get(keys, (items) => {
        const payload = JSON.stringify(
          {
            version: 1,
            chatId,
            quests: items[`sc_quests_v1_${chatId}`] || [],
            resources: items[`sc_res_v1_${chatId}`] || [],
            abilities: items[`sc_abl_v1_${chatId}`] || [],
            party: items[`sc_party_v1_${chatId}`] || [],
            npcs: items[`sc_npc_v1_${chatId}`] || [],
            rumours: items[`sc_rumour_v1_${chatId}`] || [],
            diceMods: items[`sc_dice_mod_v1_${chatId}`] || [],
          },
          null,
          2,
        );
        navigator.clipboard
          .writeText(payload)
          .then(() => {
            btn.textContent = "✓ Copied!";
            setTimeout(() => {
              btn.textContent = "Export";
            }, 2200);
          })
          .catch(() => {
            btn.textContent = "Failed";
            setTimeout(() => {
              btn.textContent = "Export";
            }, 2200);
          });
      });
    });
  });

  scNotesListEl.querySelectorAll(".sc-rpg-delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const chatId = btn.dataset.chatId;
      if (
        !confirm(
          `Delete all RPG data for chat "${chatId}"? This cannot be undone.`,
        )
      )
        return;
      const keys = RPG_PREFIXES.map(({ key }) => key + chatId);
      chrome.storage.local.remove(keys, () => loadSavedNotes());
    });
  });
}

function loadSavedNotes() {
  chrome.storage.local.get(null, (items) => {
    const chatMap = {};
    for (const { key, label } of RPG_PREFIXES) {
      for (const [storageKey, val] of Object.entries(items)) {
        if (!storageKey.startsWith(key)) continue;
        const chatId = storageKey.slice(key.length);
        if (!chatMap[chatId]) chatMap[chatId] = { chatId, counts: {} };
        chatMap[chatId].counts[label] = countItems(val);
      }
    }
    const chats = Object.values(chatMap).sort((a, b) =>
      a.chatId.localeCompare(b.chatId),
    );
    renderNotesList(chats);
  });
}

scNotesRefreshBtn.addEventListener("click", loadSavedNotes);
loadSavedNotes();

// ── RPG Import (from mobile) ──
const scRpgImportArea = document.getElementById("sc-rpg-import-area");
const scRpgImportBtn = document.getElementById("sc-rpg-import-btn");
const scRpgImportFb = document.getElementById("sc-rpg-import-fb");

scRpgImportBtn.addEventListener("click", () => {
  const raw = scRpgImportArea.value.trim();
  if (!raw) return;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    showFeedback(scRpgImportFb, "✗ Invalid JSON", false);
    return;
  }
  if (!data || data.version !== 1) {
    showFeedback(scRpgImportFb, "✗ Unknown format or version", false);
    return;
  }
  if (
    !confirm(
      `Import RPG data for chat "${data.chatId}" and replace any existing data?`,
    )
  )
    return;
  const chatId = data.chatId;
  const toSet = {};
  if (Array.isArray(data.quests)) toSet[`sc_quests_v1_${chatId}`] = data.quests;
  if (Array.isArray(data.resources))
    toSet[`sc_res_v1_${chatId}`] = data.resources;
  if (Array.isArray(data.abilities))
    toSet[`sc_abl_v1_${chatId}`] = data.abilities;
  if (Array.isArray(data.party)) toSet[`sc_party_v1_${chatId}`] = data.party;
  if (Array.isArray(data.npcs)) toSet[`sc_npc_v1_${chatId}`] = data.npcs;
  if (Array.isArray(data.rumours))
    toSet[`sc_rumour_v1_${chatId}`] = data.rumours;
  if (Array.isArray(data.diceMods))
    toSet[`sc_dice_mod_v1_${chatId}`] = data.diceMods;
  chrome.storage.local.set(toSet, () => {
    scRpgImportArea.value = "";
    showFeedback(
      scRpgImportFb,
      "✓ Imported! Reload SpicyChat to see changes.",
      true,
    );
    loadSavedNotes();
  });
});

// ─── Formatter ─────────────────────────────────────────────────────────────────────

const formatterToggle = document.getElementById("formatterToggle");
const formatterKeywordInput = document.getElementById("formatterKeywordInput");
const autoFormatAfterRewriteToggle = document.getElementById(
  "autoFormatAfterRewriteToggle",
);
const fmtExtraDelimitersInput = document.getElementById(
  "fmtExtraDelimitersInput",
);
const fmtShortcutInput = document.getElementById("fmtShortcutInput");
const saveFormatterBtn = document.getElementById("saveFormatter");
const formatterSaveFeedback = document.getElementById("formatterSaveFeedback");

const FMT_TOGGLES = [
  "fmtStripAsterisks",
  "fmtNormaliseQuotes",
  "fmtNormaliseApostrophes",
  "fmtNormaliseEllipsis",
  "fmtCollapseSpaces",
  "fmtCapitaliseI",
  "fmtCapitaliseQuotes",
  "fmtEmDash",
  "fmtNoSpaceBeforePunct",
  "fmtSpaceAfterPunct",
  "fmtTrimLines",
  "fmtNormaliseNewlines",
  "fmtCapitaliseSentences",
  "fmtUnwrapBrackets",
  "fmtRepairAsterisks",
  "fmtActionPunctuation",
  "fmtOocBrackets",
];

function syncAutoFormatRowState() {
  const row = autoFormatAfterRewriteToggle.closest(".toggle-row");
  if (formatterToggle.checked) {
    row.classList.remove("disabled");
  } else {
    row.classList.add("disabled");
  }
}

chrome.storage.sync.get(
  [
    "formatterEnabled",
    "formatterKeyword",
    "autoFormatAfterRewrite",
    "fmtExtraDelimiters",
    "fmtShortcut",
    ...FMT_TOGGLES,
  ],
  (data) => {
    formatterToggle.checked = data.formatterEnabled !== false;
    formatterKeywordInput.value = data.formatterKeyword || "//format";
    autoFormatAfterRewriteToggle.checked =
      data.autoFormatAfterRewrite !== false;
    fmtExtraDelimitersInput.value = data.fmtExtraDelimiters || "";
    fmtShortcutInput.value = (data.fmtShortcut || "m").toUpperCase();
    for (const key of FMT_TOGGLES) {
      const el = document.getElementById(key);
      if (el) el.checked = data[key] !== false;
    }
    syncAutoFormatRowState();
  },
);

formatterToggle.addEventListener("change", syncAutoFormatRowState);

// Key capture for shortcut input
fmtShortcutInput.addEventListener("keydown", (e) => {
  if (/^[a-zA-Z0-9]$/.test(e.key)) {
    e.preventDefault();
    fmtShortcutInput.value = e.key.toUpperCase();
  } else if (e.key !== "Tab" && e.key !== "Shift" && e.key !== "CapsLock") {
    e.preventDefault();
  }
});
fmtShortcutInput.addEventListener("focus", () => fmtShortcutInput.select());

saveFormatterBtn.addEventListener("click", () => {
  const kw = formatterKeywordInput.value.trim();
  if (kw && !kw.startsWith("//")) {
    formatterKeywordInput.style.borderColor = "var(--error)";
    showFeedback(formatterSaveFeedback, "Keyword must start with //", false);
    return;
  }
  formatterKeywordInput.style.borderColor = "";
  const toSave = {
    formatterEnabled: formatterToggle.checked,
    formatterKeyword: kw || "//format",
    autoFormatAfterRewrite: autoFormatAfterRewriteToggle.checked,
    fmtExtraDelimiters: fmtExtraDelimitersInput.value.trim(),
    fmtShortcut: fmtShortcutInput.value.trim().slice(0, 1).toLowerCase() || "m",
  };
  for (const key of FMT_TOGGLES) {
    const el = document.getElementById(key);
    if (el) toSave[key] = el.checked;
  }
  chrome.storage.sync.set(toSave, () => {
    showFeedback(formatterSaveFeedback, "✓ Saved!", true);
  });
});
// ─── RP Persona (5 slots) ────────────────────────────────────────────────────

const rpPersonaSlotsEl = document.getElementById("rpPersonaSlots");
const rpPersonaPillsEl = document.getElementById("rpPersonaPills");
const saveRpPersonasBtn = document.getElementById("saveRpPersonas");
const rpPersonaSaveFeedback = document.getElementById("rpPersonaSaveFeedback");
const rpActivePersonaStatus = document.getElementById("rpActivePersonaStatus");

const DEFAULT_PERSONAS = Array.from({ length: 5 }, () => ({
  label: "",
  name: "",
  prepend: "",
}));

let rpPersonasData = DEFAULT_PERSONAS.map((p) => ({ ...p }));
let rpActivePersonaIndex = -1;

function buildPersonaSlots() {
  rpPersonaSlotsEl.innerHTML = "";
  rpPersonasData.forEach((persona, idx) => {
    const isActive = idx === rpActivePersonaIndex;
    const card = document.createElement("div");
    card.className = `persona-card${isActive ? " active" : ""}`;
    card.dataset.idx = idx;
    card.innerHTML = `
      <div class="persona-card-header">
        <span class="persona-slot-num">#${idx + 1}</span>
        <input type="text" class="persona-label-input" placeholder="Slot label (e.g. Aria)" value="${escHtml(persona.label)}" data-field="label" />
        <span class="persona-active-badge">ACTIVE</span>
        <button class="persona-toggle-btn">${isActive ? "Deactivate" : "Activate"}</button>
      </div>
      <div class="form-group" style="margin: 0 0 8px;">
        <label class="form-label" style="font-size:11.5px;">Persona Name</label>
        <input type="text" class="form-input" style="padding: 6px 10px;" placeholder="e.g. Aria" value="${escHtml(persona.name)}" data-field="name" spellcheck="false" />
        <p class="form-hint">Replaces <code>{{user}}</code> in the prepend text.</p>
      </div>
      <div class="form-group" style="margin: 0;">
        <label class="form-label" style="font-size:11.5px;">Persona Prepend Text</label>
        <textarea class="form-input" rows="4" style="resize:vertical;font-family:ui-monospace,monospace;font-size:11.5px;" placeholder="e.g. You are writing a collaborative story. The human character is named {{user}}. Stay in character." data-field="prepend">${escHtml(persona.prepend)}</textarea>
        <p class="form-hint">Injected before every rewrite prompt on SpicyChat only.</p>
      </div>`;
    rpPersonaSlotsEl.appendChild(card);

    // Live-update data on input
    card.querySelectorAll("[data-field]").forEach((el) => {
      el.addEventListener("input", () => {
        rpPersonasData[idx][el.dataset.field] = el.value;
        updatePersonaStatus();
      });
    });

    // Activate / deactivate toggle
    card.querySelector(".persona-toggle-btn").addEventListener("click", () => {
      rpActivePersonaIndex = rpActivePersonaIndex === idx ? -1 : idx;
      saveRpActiveIndex();
      buildPersonaSlots();
      updatePersonaPills();
      updatePersonaStatus();
    });
  });
}

function updatePersonaPills() {
  rpPersonaPillsEl.querySelectorAll(".persona-pill").forEach((btn) => {
    const idx = parseInt(btn.dataset.idx, 10);
    const label = rpPersonasData[idx].label.trim() || String(idx + 1);
    btn.textContent = label.length > 10 ? label.slice(0, 9) + "…" : label;
    btn.classList.toggle("active", idx === rpActivePersonaIndex);
  });
}

function updatePersonaStatus() {
  if (rpActivePersonaIndex < 0) {
    rpActivePersonaStatus.textContent = "None";
  } else {
    const p = rpPersonasData[rpActivePersonaIndex];
    rpActivePersonaStatus.textContent =
      p.label.trim() || `Slot ${rpActivePersonaIndex + 1}`;
  }
}

function saveRpActiveIndex() {
  chrome.storage.sync.set({ rpActivePersonaIndex });
}

// Load persona data
chrome.storage.sync.get(
  [
    "rpPersonas",
    "rpActivePersonaIndex",
    "rpPersonaEnabled",
    "rpPersonaName",
    "rpPersonaPrepend",
  ],
  (data) => {
    if (Array.isArray(data.rpPersonas) && data.rpPersonas.length > 0) {
      // New multi-persona storage
      rpPersonasData = data.rpPersonas.slice(0, 5);
      while (rpPersonasData.length < 5)
        rpPersonasData.push({ label: "", name: "", prepend: "" });
      rpActivePersonaIndex =
        typeof data.rpActivePersonaIndex === "number"
          ? data.rpActivePersonaIndex
          : -1;
    } else if (data.rpPersonaName || data.rpPersonaPrepend) {
      // Migrate old single-persona storage → slot 0
      rpPersonasData[0] = {
        label: data.rpPersonaName || "Persona 1",
        name: data.rpPersonaName || "",
        prepend: data.rpPersonaPrepend || "",
      };
      rpActivePersonaIndex = data.rpPersonaEnabled === true ? 0 : -1;
    }
    buildPersonaSlots();
    updatePersonaPills();
    updatePersonaStatus();
  },
);

// Pill click → activate / deactivate
rpPersonaPillsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".persona-pill");
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx, 10);
  rpActivePersonaIndex = rpActivePersonaIndex === idx ? -1 : idx;
  saveRpActiveIndex();
  buildPersonaSlots();
  updatePersonaPills();
  updatePersonaStatus();
});

// Save all personas
saveRpPersonasBtn.addEventListener("click", () => {
  chrome.storage.sync.set(
    { rpPersonas: rpPersonasData, rpActivePersonaIndex },
    () => {
      showFeedback(rpPersonaSaveFeedback, "✓ Saved!", true);
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
