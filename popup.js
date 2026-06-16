// popup.js
const openOptions = () => chrome.runtime.openOptionsPage();
document.getElementById("openOptions").addEventListener("click", openOptions);
document.getElementById("openOptions2").addEventListener("click", openOptions);

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const modelText = document.getElementById("modelText");
const rewritesList = document.getElementById("rewritesList");

chrome.storage.sync.get(
  ["rpRewrites", "rpActiveRewriteIndex", "apiKey", "model"],
  (data) => {
    const rewrites = Array.isArray(data.rpRewrites) ? data.rpRewrites : [];
    const activeIdx =
      typeof data.rpActiveRewriteIndex === "number"
        ? data.rpActiveRewriteIndex
        : -1;
    const apiKey = data.apiKey || "";
    const model = data.model || "openrouter/free";

    // API key status
    if (!apiKey) {
      statusDot.className = "status-dot err";
      statusText.textContent = "No API key set";
    } else {
      statusDot.className = "status-dot ok";
      statusText.textContent = "API key active";
    }

    // Model display — show just the last segment, full ID in title tooltip
    const modelShort = model.split("/").pop();
    modelText.textContent = modelShort;
    modelText.closest(".model-pill").title = model;

    // Render rewrite preset chips (only slots that have a name or prompt)
    const filled = rewrites
      .map((r, i) => ({ ...r, i }))
      .filter((r) => (r.name || "").trim() || (r.prompt || "").trim());

    if (filled.length === 0) {
      rewritesList.innerHTML = `<div class="cmd-empty">No Rewrites set up yet.<br><span class="cmd-empty-hint">Add them in the SpicyChat side drawer → RP Tools.</span></div>`;
      return;
    }

    rewritesList.innerHTML = filled
      .map((r) => {
        const isActive = r.i === activeIdx;
        const name = (r.name || "").trim() || `Rewrite ${r.i + 1}`;
        return `
      <div class="command-chip${isActive ? " active" : ""}">
        <span class="cmd-keyword">#${r.i + 1}</span>
        <div class="cmd-right">
          <span class="cmd-label">${escHtml(name)}${isActive ? '<span class="cmd-active-tag">ACTIVE</span>' : ""}</span>
          <span class="cmd-prompt">${escHtml(r.prompt || "")}</span>
        </div>
      </div>`;
      })
      .join("");
  },
);

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// SpicyChat RPG Tracker toggle
const spicychatNotesTogglePopup = document.getElementById(
  "spicychatNotesTogglePopup",
);

chrome.storage.sync.get("spicychatNotesEnabled", (data) => {
  spicychatNotesTogglePopup.checked = data.spicychatNotesEnabled !== false;
});

spicychatNotesTogglePopup.addEventListener("change", () => {
  chrome.storage.sync.set({
    spicychatNotesEnabled: spicychatNotesTogglePopup.checked,
  });
});

// Formatter toggle
const formatterTogglePopup = document.getElementById("formatterTogglePopup");

chrome.storage.sync.get("formatterEnabled", (data) => {
  formatterTogglePopup.checked = data.formatterEnabled !== false;
});

formatterTogglePopup.addEventListener("change", () => {
  chrome.storage.sync.set({ formatterEnabled: formatterTogglePopup.checked });
});
