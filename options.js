// options.js

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
const autoFormatAfterRewriteToggle = document.getElementById(
  "autoFormatAfterRewriteToggle",
);
const fmtExtraDelimitersInput = document.getElementById(
  "fmtExtraDelimitersInput",
);
const fmtShortcutInput = document.getElementById("fmtShortcutInput");
const fmtNoTrackerShortcutInput = document.getElementById(
  "fmtNoTrackerShortcutInput",
);
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
  const rows = [autoFormatAfterRewriteToggle.closest(".toggle-row")].filter(
    Boolean,
  );
  if (formatterToggle.checked) {
    rows.forEach((row) => row.classList.remove("disabled"));
  } else {
    rows.forEach((row) => row.classList.add("disabled"));
  }
}

chrome.storage.sync.get(
  [
    "formatterEnabled",
    "autoFormatAfterRewrite",
    "fmtExtraDelimiters",
    "fmtShortcut",
    "fmtNoTrackerShortcut",
    ...FMT_TOGGLES,
  ],
  (data) => {
    formatterToggle.checked = data.formatterEnabled !== false;
    autoFormatAfterRewriteToggle.checked =
      data.autoFormatAfterRewrite !== false;
    fmtExtraDelimitersInput.value = data.fmtExtraDelimiters || "";
    fmtShortcutInput.value = (data.fmtShortcut || "m").toUpperCase();
    fmtNoTrackerShortcutInput.value = (
      data.fmtNoTrackerShortcut || "m"
    ).toUpperCase();
    for (const key of FMT_TOGGLES) {
      const el = document.getElementById(key);
      if (el) el.checked = data[key] !== false;
    }
    syncAutoFormatRowState();
  },
);

formatterToggle.addEventListener("change", syncAutoFormatRowState);

function bindShortcutInput(inputEl) {
  inputEl.addEventListener("keydown", (e) => {
    if (/^[a-zA-Z0-9]$/.test(e.key)) {
      e.preventDefault();
      inputEl.value = e.key.toUpperCase();
    } else if (e.key !== "Tab" && e.key !== "Shift" && e.key !== "CapsLock") {
      e.preventDefault();
    }
  });
  inputEl.addEventListener("focus", () => inputEl.select());
}

// Key capture for shortcut inputs
bindShortcutInput(fmtShortcutInput);
bindShortcutInput(fmtNoTrackerShortcutInput);

saveFormatterBtn.addEventListener("click", () => {
  const toSave = {
    formatterEnabled: formatterToggle.checked,
    autoFormatAfterRewrite: autoFormatAfterRewriteToggle.checked,
    fmtExtraDelimiters: fmtExtraDelimitersInput.value.trim(),
    fmtShortcut: fmtShortcutInput.value.trim().slice(0, 1).toLowerCase() || "m",
    fmtNoTrackerShortcut:
      fmtNoTrackerShortcutInput.value.trim().slice(0, 1).toLowerCase() || "m",
  };
  for (const key of FMT_TOGGLES) {
    const el = document.getElementById(key);
    if (el) toSave[key] = el.checked;
  }
  chrome.storage.sync.set(toSave, () => {
    showFeedback(formatterSaveFeedback, "✓ Saved!", true);
  });
});
// ─── RP Persona (10 slots) ───────────────────────────────────────────────────

const rpPersonaSlotsEl = document.getElementById("rpPersonaSlots");
const rpPersonaPillsEl = document.getElementById("rpPersonaPills");
const saveRpPersonasBtn = document.getElementById("saveRpPersonas");
const rpPersonaSaveFeedback = document.getElementById("rpPersonaSaveFeedback");
const rpActivePersonaStatus = document.getElementById("rpActivePersonaStatus");

const DEFAULT_PERSONAS = Array.from({ length: 10 }, () => ({
  label: "",
  name: "",
  description: "",
  personality: "",
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
        <p class="form-hint">Replaces <code>{{user}}</code> in the description and personality text.</p>
      </div>
      <div class="form-group" style="margin: 0 0 8px;">
        <label class="form-label" style="font-size:11.5px;">{{user}} Description</label>
        <textarea class="form-input" rows="4" style="resize:vertical;font-family:ui-monospace,monospace;font-size:11.5px;" placeholder="e.g. {{user}} is a weathered ex-detective in their forties, now working as a private investigator." data-field="description">${escHtml(persona.description)}</textarea>
        <p class="form-hint">Describes who <code>{{user}}</code> is. Injected before every Rewrite on SpicyChat only.</p>
      </div>
      <div class="form-group" style="margin: 0;">
        <label class="form-label" style="font-size:11.5px;">{{user}} Personality</label>
        <textarea class="form-input" rows="4" style="resize:vertical;font-family:ui-monospace,monospace;font-size:11.5px;" placeholder="e.g. {{user}} is witty, guarded, and slow to trust. Speaks in short, dry sentences." data-field="personality">${escHtml(persona.personality)}</textarea>
        <p class="form-hint">How <code>{{user}}</code> thinks, speaks and behaves. Injected after the description.</p>
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
      rpPersonasData = data.rpPersonas.slice(0, 10).map((p) => ({
        label: p.label || "",
        name: p.name || "",
        description: p.description || p.prepend || "",
        personality: p.personality || "",
      }));
      while (rpPersonasData.length < 10)
        rpPersonasData.push({
          label: "",
          name: "",
          description: "",
          personality: "",
        });
      rpActivePersonaIndex =
        typeof data.rpActivePersonaIndex === "number"
          ? data.rpActivePersonaIndex
          : -1;
    } else if (data.rpPersonaName || data.rpPersonaPrepend) {
      // Migrate old single-persona storage → slot 0
      rpPersonasData[0] = {
        label: data.rpPersonaName || "Persona 1",
        name: data.rpPersonaName || "",
        description: data.rpPersonaPrepend || "",
        personality: "",
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

// Export config for mobile
document
  .getElementById("export-mobile-config-btn")
  .addEventListener("click", () => {
    const fb = document.getElementById("export-mobile-config-fb");
    chrome.storage.sync.get(
      [
        "rpPersonas",
        "rpActivePersonaIndex",
        "rpRewrites",
        "rpActiveRewriteIndex",
      ],
      (data) => {
        const personas = (Array.isArray(data.rpPersonas) ? data.rpPersonas : [])
          .slice(0, 10)
          .map((p) => ({
            label: p.label || "",
            name: p.name || "",
            description: p.description || p.prepend || "",
            personality: p.personality || "",
          }));
        while (personas.length < 10)
          personas.push({
            label: "",
            name: "",
            description: "",
            personality: "",
          });

        const rewrites = (Array.isArray(data.rpRewrites) ? data.rpRewrites : [])
          .slice(0, 5)
          .map((r) => ({ name: r.name || "", prompt: r.prompt || "" }));
        while (rewrites.length < 5) rewrites.push({ name: "", prompt: "" });

        const config = {
          version: 1,
          type: "config",
          personas,
          activePersonaIdx:
            typeof data.rpActivePersonaIndex === "number"
              ? data.rpActivePersonaIndex
              : -1,
          rewrites,
          activeRewriteIdx:
            typeof data.rpActiveRewriteIndex === "number"
              ? data.rpActiveRewriteIndex
              : -1,
        };

        navigator.clipboard
          .writeText(JSON.stringify(config, null, 2))
          .then(() => showFeedback(fb, "✓ Copied to clipboard!", true))
          .catch(() => showFeedback(fb, "✗ Copy failed", false));
      },
    );
  });

// Export personas
document.getElementById("export-personas-btn").addEventListener("click", () => {
  const fb = document.getElementById("export-personas-fb");
  const payload = {
    version: 1,
    type: "personas",
    personas: rpPersonasData.map((p) => ({
      label: p.label || "",
      name: p.name || "",
      description: p.description || "",
      personality: p.personality || "",
    })),
    activePersonaIdx: rpActivePersonaIndex,
  };
  navigator.clipboard
    .writeText(JSON.stringify(payload, null, 2))
    .then(() => showFeedback(fb, "\u2713 Copied!", true))
    .catch(() => showFeedback(fb, "\u2717 Copy failed", false));
});

// Import personas
document.getElementById("import-personas-btn").addEventListener("click", () => {
  const fb = document.getElementById("import-personas-fb");
  const area = document.getElementById("import-personas-area");
  const raw = area.value.trim();
  if (!raw) {
    showFeedback(fb, "\u2717 Nothing to import", false);
    return;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    showFeedback(fb, "\u2717 Invalid JSON", false);
    return;
  }
  if (
    !data ||
    data.version !== 1 ||
    data.type !== "personas" ||
    !Array.isArray(data.personas)
  ) {
    showFeedback(fb, "\u2717 Unrecognised format", false);
    return;
  }
  const incoming = data.personas
    .slice(0, 10)
    .map((p) => ({
      label: (p && p.label) || "",
      name: (p && p.name) || "",
      description: (p && (p.description || p.prepend)) || "",
      personality: (p && p.personality) || "",
    }));
  while (incoming.length < 10)
    incoming.push({ label: "", name: "", description: "", personality: "" });
  rpPersonasData = incoming;
  rpActivePersonaIndex =
    typeof data.activePersonaIdx === "number" ? data.activePersonaIdx : -1;
  chrome.storage.sync.set(
    { rpPersonas: rpPersonasData, rpActivePersonaIndex },
    () => {
      buildPersonaSlots();
      updatePersonaPills();
      updatePersonaStatus();
      area.value = "";
      showFeedback(fb, "\u2713 Imported!", true);
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
