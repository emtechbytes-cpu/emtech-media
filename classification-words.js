/* ============================================================
   EmTech Media — shared classification vocabulary (Phase 3.2.1 §15)

   ONE canonical source for the platform/category word lists used by:
     * browser → window.EmTechClassificationWords, consumed by
                 ai-knowledge.js (classifyProblem / searchForSession)
     * worker  → module.exports, consumed by ai-api/src/policy.js
                 (pre-AI router classifyText / deterministicRoute)

   Load order in HTML pages: BEFORE ai-knowledge.js.

   Do NOT fork these lists into other files. If a word is missing here,
   add it HERE so the frontend and worker routers stay in sync —
   ai-api/test/schema.test.mjs fails if the two runtimes drift apart.
   ============================================================ */
const EMTECH_CLASSIFICATION_WORDS = {
  version: "1.3.0", // bump when a word is added/removed (stamped for debugging)

  PLATFORM_WORDS: {
    mac: ["macbook", "imac", "macos", "osx", "apple silicon", "mac mini", "mac studio", "mac laptop", "mac desktop", "my mac ", "on my mac"],
    windows: ["windows", "win10", "win 10", "win11", "win 11", "task manager", "control panel"],
  },

  CATEGORY_WORDS: {
    performance: ["slow", "sluggish", "laggy", "freezing", "frozen", "hangs", "takes forever", "unresponsive", "beachball", "high cpu", "cpu at 100%", "using too much memory", "out of memory"],
    overheating: ["hot", "overheat", "fan", "fans", "loud", "thermal", "throttl"],
    network: ["wifi", "wi-fi", "wireless", "internet", "disconnect", "drops", "buffering", "router", "ethernet"],
    storage: ["storage", "disk space", "drive full", "almost full", "not enough space", "not enough storage", "running out of space", "low on space", "no space left", "temp files", "cache"],
    audio: ["no sound", "silent", "microphone", "mic ", "webcam", "camera won't", "headphones"],
    updates: ["windows update", "update stuck", "updates failing", "restarts at 3am", "active hours", "macos update", "update failed", "update won't install", "update error"],
    crashes: ["blue screen", "bsod", "crash", "won't start", "wont start", "black screen", "goes black", "screen goes dark", "random restarts", "gatekeeper", "no signal", "won't turn on", "wont turn on", "no power"],
    gaming: ["game", "games", "fps", "stutter", "lag spike", "input lag", "framerate"],
    security: ["virus", "malware", "ransomware", "phishing", "scam", "pop-up", "popup", "pop up", "popups", "optimizer", "encrypt"],
    /* Phase 3.3 — Bluetooth/headphones intent precision (Part 1).
       Pairing/connect phrases are hardware intent even when a headphone
       word is present: "headphones won't connect/pair" is a pairing problem,
       while "no sound" / "silent" stay audio. Phrase weight keeps these from
       hijacking plain Wi-Fi or audio phrasing (no bare "pair"/"connect"). */
    hardware: ["ram", "ssd", "hard drive", "battery", "printer", "usb", "keyboard", "trackpad", "touchpad", "upgrade", "bluetooth", "external monitor", "second screen", "mouse",
      "won't pair", "wont pair", "can't pair", "cant pair", "not pairing", "failed to pair",
      "headphones won't connect", "headphones wont connect", "earbuds won't connect",
      "bluetooth won't connect", "bluetooth wont connect"],
  },
};

/* Browser global (ai-knowledge.js reads this). In the browser and in Node,
   `globalThis` is the right target; older runtimes fall back to window. */
if (typeof globalThis !== "undefined") globalThis.EmTechClassificationWords = EMTECH_CLASSIFICATION_WORDS;
else if (typeof window !== "undefined") window.EmTechClassificationWords = EMTECH_CLASSIFICATION_WORDS;

/* Server-side export for the EmTech AI API worker — same pattern as
   tips-data.js / diag-data.js. No-op in the browser, where `module` is
   undefined. */
if (typeof module !== "undefined") {
  module.exports = EMTECH_CLASSIFICATION_WORDS;
}
