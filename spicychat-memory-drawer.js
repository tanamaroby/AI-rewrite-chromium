(function () {
  "use strict";

  /* Only run on SpicyChat chat pages */
  if (!/^\/chat\//.test(location.pathname)) return;

  // Check the toggle before doing anything — bail immediately if disabled.
  chrome.storage.sync.get("spicychatDrawerEnabled", (data) => {
    if (data.spicychatDrawerEnabled === false) return;
    init();
  });

  function init() {
    const DRAWER_W = 440;
    const LS_KEY = "sc_memdrawer_v1";

    let isOpen = false;
    let portalRoot = null; // The dialog element itself (direct body child)
    let dialogEl = null; // Same as portalRoot — the .z-[900000] div
    let backdropEl = null; // The inset-0 backdrop sibling, if any

    /* ─────────────────────────────────────────
     CSS
  ───────────────────────────────────────── */
    const style = document.createElement("style");
    style.textContent = `
    /* Drawer panel */
    #sc-mdr {
      position: fixed;
      top: 56px; right: 0;
      width: ${DRAWER_W}px;
      height: calc(100dvh - 56px);
      background: #0f0e1a;
      border-left: 1px solid rgba(108, 99, 255, 0.25);
      box-shadow: -6px 0 32px rgba(0, 0, 0, 0.6);
      z-index: 8500;
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: none;
    }
    #sc-mdr.sc-mdr-open {
      transform: none;
      pointer-events: all;
    }

    /* Push main content left when drawer is open. */
    body.sc-dr-open [relay-container="true"] {
      margin-right: ${DRAWER_W}px;
      transition: margin-right 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    }
    body:not(.sc-dr-open) [relay-container="true"] {
      margin-right: 0;
      transition: margin-right 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Persistent tab button on the right edge */
    #sc-mdr-tab {
      position: fixed;
      top: 64px; right: 0;
      width: 28px; height: 52px;
      background: #1c1834;
      color: #a78bfa;
      border: 1px solid rgba(108, 99, 255, 0.35);
      border-right: none;
      border-radius: 8px 0 0 8px;
      cursor: pointer;
      z-index: 8499;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: right 0.28s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s;
    }
    #sc-mdr-tab:hover { background: #271f4a; }
    body.sc-dr-open #sc-mdr-tab { right: ${DRAWER_W}px; }

    /* Drawer header — hidden: the docked dialog provides its own title/close */
    #sc-mdr-header {
      display: none;
    }
    #sc-mdr-close:hover { color: #e2e8f0; background: rgba(255,255,255,0.07); }

    /* Drawer body */
    #sc-mdr-body {
      flex: 1;
      overflow: hidden;
      position: relative;
    }

    /* Placeholder shown when no dialog is docked */
    #sc-mdr-placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
      color: #475569;
      font-family: sans-serif;
      font-size: 12.5px;
      line-height: 1.75;
      gap: 8px;
    }
    #sc-mdr-placeholder svg { opacity: 0.35; margin-bottom: 4px; }
    #sc-mdr-placeholder kbd {
      display: inline-block;
      padding: 1px 6px;
      background: rgba(108, 99, 255, 0.12);
      border: 1px solid rgba(108, 99, 255, 0.28);
      border-radius: 4px;
      font-size: 11px;
      color: #a78bfa;
      font-family: sans-serif;
    }

    /* ── Docked portal: CSS repositioning ──
       The dialog element IS the .z-[900000] div — it's a direct <body> child.
       We add .sc-mdr-docked to it directly, and .sc-mdr-backdrop to the
       inset-0 overlay sibling to hide it.
    */
    .sc-mdr-docked {
      position: fixed !important;
      top: 56px !important;
      right: 0 !important;
      left: auto !important;
      bottom: 0 !important;
      width: ${DRAWER_W}px !important;
      height: calc(100dvh - 56px) !important;
      max-width: none !important;
      max-height: none !important;
      border-radius: 0 !important;
      margin: 0 !important;
      transform: none !important;
      box-shadow: none !important;
      z-index: 8501 !important;
      pointer-events: all !important;
    }
    .sc-mdr-backdrop {
      display: none !important;
    }
  `;
    document.head.appendChild(style);

    /* ─────────────────────────────────────────
     DOM
  ───────────────────────────────────────── */
    const drawer = document.createElement("div");
    drawer.id = "sc-mdr";
    drawer.innerHTML = `
    <div id="sc-mdr-header">
      <span id="sc-mdr-title">Memories</span>
      <button id="sc-mdr-close" aria-label="Close memories drawer" title="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div id="sc-mdr-body">
      <div id="sc-mdr-placeholder">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a78bfa"
             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962
                   L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0
                   L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964
                   L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
          <path d="M20 3v4"/><path d="M22 5h-4"/>
          <path d="M4 17v2"/><path d="M5 18H3"/>
        </svg>
        <span>
          Click the <kbd>&#8943;</kbd> button above the chat,<br>
          then <kbd>Manage Memories</kbd>
        </span>
      </div>
    </div>`;

    const tab = document.createElement("button");
    tab.id = "sc-mdr-tab";
    tab.setAttribute("aria-label", "Toggle memories drawer");
    tab.title = "Memories";
    tab.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962
               L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0
               L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964
               L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
      <path d="M20 3v4"/><path d="M22 5h-4"/>
      <path d="M4 17v2"/><path d="M5 18H3"/>
    </svg>`;

    document.body.appendChild(drawer);
    document.body.appendChild(tab);

    const placeholder = document.getElementById("sc-mdr-placeholder");

    /* ─────────────────────────────────────────
     State helpers
  ───────────────────────────────────────── */
    function setOpen(val) {
      isOpen = val;
      drawer.classList.toggle("sc-mdr-open", val);
      document.body.classList.toggle("sc-dr-open", val);
      try {
        localStorage.setItem(LS_KEY, val ? "1" : "0");
      } catch (_) {}
    }

    function cleanup() {
      if (dialogEl) dialogEl.classList.remove("sc-mdr-docked");
      if (backdropEl) backdropEl.classList.remove("sc-mdr-backdrop");
      portalRoot = null;
      dialogEl = null;
      backdropEl = null;
      placeholder.style.display = "";
    }

    function closeDrawer() {
      setOpen(false);
      // Click the dialog's own close button so React properly unmounts it.
      // Keep sc-mdr-docked on while the close animates — the drawer slides away,
      // carrying the dialog with it visually, before React removes the node.
      const nativeClose =
        dialogEl && dialogEl.querySelector('[aria-label="X-button"]');
      if (nativeClose) {
        nativeClose.click();
        // cleanup() will be called by the MutationObserver when the portal is removed
      } else {
        cleanup();
      }
    }

    /* ─────────────────────────────────────────
     Button events
  ───────────────────────────────────────── */
    document
      .getElementById("sc-mdr-close")
      .addEventListener("click", closeDrawer);

    tab.addEventListener("click", () => {
      if (isOpen) {
        closeDrawer();
      } else {
        setOpen(true);
        if (!portalRoot) triggerManageMemories();
      }
    });

    /* ─────────────────────────────────────────
     Intercept "Manage Memories" from the dropdown
     — ensures drawer is open whenever the user triggers it manually.
  ───────────────────────────────────────── */
    document.addEventListener(
      "click",
      (e) => {
        let node = e.target;
        while (node && node !== document.body) {
          if (
            node.getAttribute &&
            node.getAttribute("aria-label") === "Manage Memories"
          ) {
            if (!isOpen) setOpen(true);
            break;
          }
          node = node.parentElement;
        }
      },
      /* capture */ true,
    );

    /* ─────────────────────────────────────────
     MutationObserver — detect dialog open / close
     Only watches direct <body> children (no subtree) to avoid freezing
     the page. Docking is handled by pollForDialog().
  ───────────────────────────────────────── */
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (!portalRoot) {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.id && node.id.startsWith("sc-mdr")) continue;
            // Check if this node IS the dialog div or CONTAINS it
            const candidate = isMemoriesDialogEl(node)
              ? node
              : node.querySelector &&
                  node.querySelector(".z-\\[900000\\]") &&
                  isMemoriesDialogEl(node.querySelector(".z-\\[900000\\]"))
                ? node.querySelector(".z-\\[900000\\]")
                : null;
            if (candidate) {
              console.log(
                "[sc-mdr] MutationObserver: found dialog in addedNode",
                candidate,
              );
              let pRoot = candidate;
              while (
                pRoot.parentElement &&
                pRoot.parentElement !== document.body
              ) {
                pRoot = pRoot.parentElement;
              }
              dockDialog(pRoot, candidate);
              break;
            }
          }
        } else {
          // Dialog closed: the dialog el or an ancestor was removed
          for (const node of m.removedNodes) {
            if (
              node === portalRoot ||
              node === dialogEl ||
              (node.contains && node.contains(dialogEl))
            ) {
              console.log(
                "[sc-mdr] MutationObserver: dialog removed, cleaning up",
              );
              cleanup();
              break;
            }
          }
        }
      }
    }).observe(document.body, { childList: true });

    /**
     * Returns true if `el` is the Memories dialog element (.z-[900000])
     * confirmed by finding a child whose sole text is "Memories".
     */
    function isMemoriesDialogEl(el) {
      if (!el.classList || !el.classList.contains("z-[900000]")) return false;
      const found = Array.from(el.querySelectorAll("*")).some(
        (child) =>
          child.childElementCount === 0 &&
          child.textContent.trim() === "Memories",
      );
      console.log(
        "[sc-mdr] isMemoriesDialogEl check:",
        el.className.slice(0, 60),
        "-> found:",
        found,
      );
      return found;
    }

    /**
     * Apply the docking CSS class so the dialog is repositioned into the drawer.
     * No DOM nodes are moved; React's event delegation stays intact.
     */
    function dockDialog(pRoot, dlgEl) {
      // pRoot IS the dialog element — it's a direct <body> child with .z-[900000]
      portalRoot = pRoot;
      dialogEl = dlgEl || pRoot;
      console.log("[sc-mdr] dockDialog: adding sc-mdr-docked to", dialogEl);
      dialogEl.classList.add("sc-mdr-docked");
      console.log(
        "[sc-mdr] dockDialog: computed position =",
        getComputedStyle(dialogEl).position,
        "right =",
        getComputedStyle(dialogEl).right,
      );
      // Hide the backdrop sibling (fixed inset-0 overlay)
      const backdrop = document.querySelector(".z-\\[900000\\].inset-0");
      if (backdrop && backdrop !== dialogEl) {
        backdrop.classList.add("sc-mdr-backdrop");
        backdropEl = backdrop;
        console.log("[sc-mdr] dockDialog: backdrop hidden", backdrop);
      }
      placeholder.style.display = "none";
      if (!isOpen) setOpen(true);
    }

    /* ─────────────────────────────────────────
     Auto-trigger: open chat-dropdown → click Manage Memories
  ───────────────────────────────────────── */
    function triggerManageMemories() {
      const chatDropdownBtn = document.querySelector(
        '[aria-label="chat-dropdown"]',
      );
      if (!chatDropdownBtn) {
        // Chat not rendered yet — retry
        setTimeout(triggerManageMemories, 600);
        return;
      }

      chatDropdownBtn.click();
      console.log("[sc-mdr] Clicked chat-dropdown button");

      let tries = 15;
      const findItem = () => {
        // The dropdown renders plain <button aria-label="Manage Memories"> elements
        const btn = document.querySelector('[aria-label="Manage Memories"]');
        if (btn) {
          console.log("[sc-mdr] Found Manage Memories button, clicking");
          btn.click();
          // Polling fallback: if the dialog lands inside a pre-existing portal
          // container the MutationObserver may miss it — poll directly.
          pollForDialog();
          return;
        }
        console.log(
          "[sc-mdr] Manage Memories button not found yet, tries left:",
          tries,
        );
        if (--tries > 0) {
          setTimeout(findItem, 150);
        } else {
          // Couldn't find the item — dismiss the dropdown gracefully
          document.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Escape",
              bubbles: true,
              cancelable: true,
            }),
          );
        }
      };
      setTimeout(findItem, 200);
    }

    /**
     * Polling fallback: scans for .z-[900000] directly in case the dialog
     * appeared inside a pre-existing portal container (no body childList event).
     */
    function pollForDialog() {
      if (portalRoot) return;
      let polls = 30;
      const check = () => {
        if (portalRoot) return; // already docked by MutationObserver
        const dlg = document.querySelector(".z-\\[900000\\]");
        console.log(
          "[sc-mdr] pollForDialog check",
          30 - polls + 1,
          "/ 30 — dlg found:",
          !!dlg,
        );
        if (dlg && isMemoriesDialogEl(dlg)) {
          let pRoot = dlg;
          while (pRoot.parentElement && pRoot.parentElement !== document.body) {
            pRoot = pRoot.parentElement;
          }
          console.log("[sc-mdr] pollForDialog: docking dialog");
          dockDialog(pRoot, dlg);
          return;
        }
        if (--polls > 0) setTimeout(check, 100);
        else console.log("[sc-mdr] pollForDialog: gave up after 30 polls");
      };
      setTimeout(check, 100);
    }

    /* ─────────────────────────────────────────
     Initialise — always start closed
  ───────────────────────────────────────── */
    // Drawer is always closed on page load. User opens it via the tab button.
  } // end init()
})();
