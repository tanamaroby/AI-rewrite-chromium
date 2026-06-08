// background.js — Service Worker
// Handles AI API calls to keep API keys secure and avoid CORS issues

const DEFAULT_COMMANDS = [
  {
    keyword: "//re",
    label: "Rewrite",
    prompt:
      "Rewrite the text. Improve clarity, flow, and word choice—keep it simple and natural. Preserve all meaning, tone, and character voices. Do not add plot, characters, or events. Return only the rewritten text.",
  },
];

// Initialize default commands on install
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get(["commands", "apiKey", "model"]);
  if (!data.commands) {
    await chrome.storage.sync.set({ commands: DEFAULT_COMMANDS });
  }
  if (!data.model) {
    await chrome.storage.sync.set({
      model: "openrouter/free",
    });
  }
});

// Listen for rewrite requests from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "REWRITE_TEXT") {
    handleRewrite(message.text, message.prompt, message.apiKey, message.model)
      .then((result) =>
        sendResponse({ success: true, text: result.text, model: result.model }),
      )
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }
});

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000; // base delay; doubles each attempt

async function handleRewrite(text, prompt, apiKey, model) {
  if (!apiKey) {
    throw new Error(
      "No API key set. Please configure your OpenRouter API key in the extension options.",
    );
  }

  const resolvedModel = model || "openrouter/free";
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 2s, 4s, 8s
      await new Promise((r) =>
        setTimeout(r, RETRY_DELAY_MS * Math.pow(2, attempt - 1)),
      );
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "chrome-extension://ai-rewriter",
          "X-Title": "AI Rewriter Extension",
        },
        body: JSON.stringify({
          model: resolvedModel,
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: text },
          ],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      },
    );

    if (response.status === 429) {
      // Respect Retry-After header if present
      const retryAfter = response.headers.get("Retry-After");
      const waitMs = retryAfter
        ? parseFloat(retryAfter) * 1000
        : RETRY_DELAY_MS * Math.pow(2, attempt);
      lastError = new Error(
        `Rate limit hit (attempt ${attempt + 1}/${MAX_RETRIES}). Retrying in ${Math.round(waitMs / 1000)}s…`,
      );
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const detail = errBody?.error?.message || response.statusText;
      throw new Error(`API error ${response.status}: ${detail}`);
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim();
    const usedModel = data.model || resolvedModel;
    if (!result) {
      // Empty response — treat like a retryable failure
      lastError = new Error(
        `Empty response from AI (attempt ${attempt + 1}/${MAX_RETRIES}).`,
      );
      continue;
    }
    return { text: result, model: usedModel };
  }

  // All retries exhausted
  throw (
    lastError ||
    new Error(
      `Rate limit exceeded after ${MAX_RETRIES} attempts. Try switching to a paid model in options.`,
    )
  );
}
