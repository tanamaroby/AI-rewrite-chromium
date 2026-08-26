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

// ─── SpicyChat RPG Tracker ─────────────────────────────────────────────────────────

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

const RPG_SECTIONS = [
  { key: "sc_quests_v1_", label: "Quests", type: "array" },
  { key: "sc_res_v1_", label: "Resources", type: "array" },
  { key: "sc_abl_v1_", label: "Abilities", type: "array" },
  { key: "sc_party_v1_", label: "Party", type: "array" },
  { key: "sc_npc_v1_", label: "NPCs", type: "array" },
  { key: "sc_rumour_v1_", label: "Rumours", type: "array" },
  { key: "sc_dice_mod_v1_", label: "Dice Mods", type: "array" },
];

const RPG_LEGACY_PREFIXES = ["sc_inv_v1_"];

function getRpgKeysForChat(chatId, includeLegacy = false) {
  const keys = RPG_SECTIONS.map(({ key }) => key + chatId);
  if (includeLegacy) {
    RPG_LEGACY_PREFIXES.forEach((prefix) => keys.push(prefix + chatId));
  }
  return keys;
}

function countSectionEntries(val, type) {
  if (type === "array") return Array.isArray(val) ? val.length : 0;
  if (type === "object") {
    if (!val || typeof val !== "object" || Array.isArray(val)) return 0;
    return Object.values(val).some((v) => String(v || "").trim()) ? 1 : 0;
  }
  return 0;
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
    const summaryParts = RPG_SECTIONS.map(({ label }) => {
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
      const keys = getRpgKeysForChat(chatId);
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
      const keys = getRpgKeysForChat(chatId, true);
      chrome.storage.local.remove(keys, () => loadSavedNotes());
    });
  });
}

function loadSavedNotes() {
  chrome.storage.local.get(null, (items) => {
    const chatMap = {};
    for (const { key, label, type } of RPG_SECTIONS) {
      for (const [storageKey, val] of Object.entries(items)) {
        if (!storageKey.startsWith(key)) continue;
        const chatId = storageKey.slice(key.length);
        if (!chatMap[chatId]) chatMap[chatId] = { chatId, counts: {} };
        chatMap[chatId].counts[label] = countSectionEntries(val, type);
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
  "fmtPreserveLists",
  "fmtPreserveBlockquotes",
  "fmtPreserveSpeakerTags",
  "fmtPreserveSeparator",
  "fmtPreserveBold",
  "fmtUnwrapBrackets",
  "fmtUnwrapParens",
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

// Export config for mobile
document
  .getElementById("export-mobile-config-btn")
  .addEventListener("click", () => {
    const fb = document.getElementById("export-mobile-config-fb");
    chrome.storage.sync.get(["rpRewrites", "rpActiveRewriteIndex"], (data) => {
      const rewrites = (Array.isArray(data.rpRewrites) ? data.rpRewrites : [])
        .slice(0, 10)
        .map((r) => ({ name: r.name || "", prompt: r.prompt || "" }));
      while (rewrites.length < 10) rewrites.push({ name: "", prompt: "" });

      const config = {
        version: 1,
        type: "config",
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
