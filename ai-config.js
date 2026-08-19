/* ============================================================
   EmTech Media — Phase 3.1 AI configuration (no DOM, no logic)

   Two modes (§8/§30):
     cloud → the public EmTech AI API worker (ai-api/), which holds the
             Qwen API key server-side and proxies to the Qwen cloud API.
             The browser never sees credentials or model endpoints (§5).
     local → the bundled dev gateway (ai-gateway/server.mjs) in front of a
             locally hosted Qwen (LM Studio / Ollama on this machine).

   Nothing here holds credentials: keys live on the backend (worker secret
   for cloud, env var for the local gateway), never in this file or in
   localStorage.

   Resolution order per field:
     1. Settings saved from the AI page's settings panel
        (localStorage "emtech-ai-settings-v1") — so you can point a
        deployed site at your own worker without editing code.
     2. The defaults below.

   resolveConfig() returns an effective `endpoint` + `healthUrl` pair, so
   the provider layer never needs to know which mode is active (§9).
   ============================================================ */
(function () {
  "use strict";

  const SETTINGS_KEY = "emtech-ai-settings-v1";

  /* Production default: cloud API (§61). After deploying ai-api/, if your
     worker URL differs, change this one line — or save it from the AI page's
     settings panel (no code edit needed for that). */
  const CLOUD_ENDPOINT_DEFAULT = "https://emtech-ai-api.emtechbytes-cpu.workers.dev/api/ai";

  const DEFAULTS = Object.freeze({
    mode: "cloud", // "cloud" | "local" (§30) — production default is cloud (§61)
    cloudEndpoint: CLOUD_ENDPOINT_DEFAULT,
    gatewayUrl: "http://localhost:8787/v1/chat/completions", // local mode only
    model: "ollama/qwen3.8-27b",   // local mode only — the cloud model is configured server-side (§38)
    temperature: 0.2,      // low on purpose — troubleshooting wants consistency (§39)
    // Qwen3-style models spend part of the budget on internal reasoning before
    // emitting the JSON answer — leave headroom or `content` comes back empty.
    maxTokens: 2500,
    timeoutMs: 60000,      // hard ceiling per request (§33)
    healthTimeoutMs: 2500, // preflight check only; never blocks the page
  });

  function isHttpUrl(v) {
    try {
      const u = new URL(String(v));
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (err) {
      return false;
    }
  }

  /* Read + sanitize saved settings. Corrupted values are dropped, not fatal (§27). */
  function loadSettings() {
    let raw = null;
    try { raw = window.localStorage.getItem(SETTINGS_KEY); } catch (err) { return {}; }
    if (!raw) return {};
    let s = null;
    try { s = JSON.parse(raw); } catch (err) { return {}; }
    if (!s || typeof s !== "object") return {};

    const out = {};
    if (s.mode === "cloud" || s.mode === "local") out.mode = s.mode;
    if (isHttpUrl(s.cloudEndpoint)) out.cloudEndpoint = String(s.cloudEndpoint).slice(0, 300);
    if (isHttpUrl(s.gatewayUrl)) out.gatewayUrl = String(s.gatewayUrl).slice(0, 300);
    if (typeof s.model === "string" && s.model.trim()) out.model = s.model.trim().slice(0, 120);
    return out;
  }

  function saveSettings(patch) {
    const current = loadSettings();
    const next = Object.assign({}, current, patch || {});
    if (next.mode !== undefined && next.mode !== "cloud" && next.mode !== "local") delete next.mode;
    if (next.cloudEndpoint !== undefined && !isHttpUrl(next.cloudEndpoint)) delete next.cloudEndpoint;
    if (next.gatewayUrl !== undefined && !isHttpUrl(next.gatewayUrl)) delete next.gatewayUrl;
    if (next.model !== undefined && typeof next.model !== "string") delete next.model;
    try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch (err) {}
    return loadSettings();
  }

  function clearSettings() {
    try { window.localStorage.removeItem(SETTINGS_KEY); } catch (err) {}
    return {};
  }

  /* Effective config for a call: defaults ← saved settings, plus the derived
     endpoint/healthUrl pair used by the provider and the health check. */
  function resolveConfig() {
    const cfg = Object.assign({}, DEFAULTS, loadSettings());
    if (cfg.mode === "local") {
      cfg.endpoint = isHttpUrl(cfg.gatewayUrl) ? String(cfg.gatewayUrl) : "";
      try { cfg.healthUrl = new URL(cfg.gatewayUrl).origin + "/healthz"; } catch (err) { cfg.healthUrl = null; }
    } else {
      const ep = isHttpUrl(cfg.cloudEndpoint) ? String(cfg.cloudEndpoint) : "";
      cfg.endpoint = ep;
      try {
        // The worker exposes /api/ai and /api/health side by side.
        const u = new URL(ep);
        u.pathname = u.pathname.replace(/\/+$/, "");
        if (u.pathname.endsWith("/api/ai")) u.pathname = u.pathname.slice(0, -"/api/ai".length) + "/api/health";
        else u.pathname += "/api/health";
        cfg.healthUrl = u.toString();
      } catch (err) { cfg.healthUrl = null; }
    }
    return cfg;
  }

  window.EmTechAIConfig = {
    SETTINGS_KEY,
    CLOUD_ENDPOINT_DEFAULT,
    defaults: DEFAULTS,
    loadSettings,
    saveSettings,
    clearSettings,
    resolveConfig,
  };
})();
