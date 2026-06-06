// popup.js
const openOptions = () => chrome.runtime.openOptionsPage();
document.getElementById("openOptions").addEventListener("click", openOptions);
document.getElementById("openOptions2").addEventListener("click", openOptions);

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const modelText = document.getElementById("modelText");
const commandsList = document.getElementById("commandsList");

chrome.storage.sync.get(["commands", "apiKey", "model"], (data) => {
  const commands = data.commands || [];
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

  // Render command chips
  if (commands.length === 0) {
    commandsList.innerHTML = `<div class="cmd-empty">No keywords defined yet.<br><span class="cmd-empty-hint">Add some in Settings.</span></div>`;
    return;
  }

  commandsList.innerHTML = commands
    .map(
      (cmd) => `
      <div class="command-chip">
        <span class="cmd-keyword">${escHtml(cmd.keyword)}</span>
        <div class="cmd-right">
          <span class="cmd-label">${escHtml(cmd.label || "Custom")}</span>
          <span class="cmd-prompt">${escHtml(cmd.prompt || "")}</span>
        </div>
      </div>`,
    )
    .join("");
});

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// SpicyChat drawer toggle
const spicychatDrawerTogglePopup = document.getElementById(
  "spicychatDrawerTogglePopup",
);

chrome.storage.sync.get("spicychatDrawerEnabled", (data) => {
  spicychatDrawerTogglePopup.checked = data.spicychatDrawerEnabled !== false;
});

spicychatDrawerTogglePopup.addEventListener("change", () => {
  chrome.storage.sync.set({
    spicychatDrawerEnabled: spicychatDrawerTogglePopup.checked,
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
