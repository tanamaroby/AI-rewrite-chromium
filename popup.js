// popup.js
const openOptions = () => chrome.runtime.openOptionsPage();
document.getElementById("openOptions").addEventListener("click", openOptions);
document.getElementById("openOptions2").addEventListener("click", openOptions);

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const commandsList = document.getElementById("commandsList");

chrome.storage.sync.get(["commands", "apiKey"], (data) => {
  const commands = data.commands || [];
  const apiKey = data.apiKey || "";

  // API key status
  if (!apiKey) {
    statusDot.className = "status-dot err";
    statusText.textContent = "No API key — set one in options";
  } else {
    statusDot.className = "status-dot ok";
    statusText.textContent = "API key configured";
  }

  // Render command chips
  if (commands.length === 0) {
    commandsList.innerHTML = `<div class="cmd-empty">No keywords defined yet.</div>`;
    return;
  }

  commandsList.innerHTML = commands
    .map(
      (cmd) => `
      <div class="command-chip">
        <span class="cmd-keyword">${escHtml(cmd.keyword)}</span>
        <span class="cmd-label">${escHtml(cmd.label || "Custom")}</span>
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
