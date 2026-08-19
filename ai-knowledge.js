/* ============================================================
   EmTech Media — Phase 3 KNOWLEDGE BASE LAYER (no DOM, no logic)

   One knowledge base for search AND AI (§10): everything here reads
   from tips-data.js (TIPS + tipSlug), diag-data.js
   (window.EMTECH_DIAG_DATA) and classification-words.js
   (window.EmTechClassificationWords — shared with the worker's pre-AI
   router, Phase 3.2.1 §15). Load order: tips-data → diag-data →
   classification-words → this.

   Responsibilities:
     * normalize user text + expand common synonyms (§42)
     * rank the fix library for a query (reuses Phase 1 scoring shape)
     * classify platform/category from free text (local, deterministic)
     * render retrieved fixes into the knowledge context block that is
       sent to Qwen (§15) — only relevant entries, never the whole site (§40)
     * expose the approved question library so the AI can only ask
       questions EmTech has already written (§22/§23)

   Exposes window.EmTechAIKnowledge.
   ============================================================ */
(function () {
  "use strict";

  const VERSION = "1.0.0"; // knowledge base version — stamped into AI sessions (§37)

  /* ---------- Normalization + synonyms (§42) ---------- */
  function normalize(text) {
    return String(text == null ? "" : text).toLowerCase().replace(/\s+/g, " ").trim();
  }

  /* token → aliases. Used to score queries like "wifi" against tips that
     say "Wi-Fi", or "graphics card" against "GPU". */
  const SYNONYMS = {
    wifi: ["wi-fi", "wireless"],
    "wi-fi": ["wifi", "wireless"],
    wireless: ["wifi", "wi-fi"],
    gpu: ["graphics card", "graphics processor", "video card"],
    "graphics card": ["gpu", "graphics processor"],
    ram: ["memory"],
    memory: ["ram"],
    ssd: ["solid state drive", "nvme"],
    hdd: ["hard drive", "hard disk"],
    "hard drive": ["hdd"],
    laptop: ["notebook"],
    macbook: ["mac"],
    mac: ["macbook", "osx", "macos"],
    windows: ["win10", "win 10", "win11", "win 11"],
    bsod: ["blue screen"],
    "blue screen": ["bsod"],
    fan: ["fans", "cooling"],
    fans: ["fan", "cooling"],
    overheating: ["overheat", "hot", "runs hot"],
    overheat: ["overheating", "hot"],
    slow: ["sluggish", "laggy", "lag", "slowdown"],
    sluggish: ["slow", "laggy"],
    freeze: ["freezing", "frozen", "hangs", "hanging"],
    freezing: ["freeze", "frozen"],
    crash: ["crashing", "crashed"],
    stutter: ["stuttering", "stutters", "lag spikes"],
  };

  function expandTokens(tokens) {
    const out = [];
    for (const t of tokens || []) {
      if (!t) continue;
      out.push(t);
      const aliases = SYNONYMS[t];
      if (aliases) for (const a of aliases) if (out.indexOf(a) === -1) out.push(a);
    }
    return out;
  }

  /* ---------- Library access ---------- */
  function tips() {
    try { if (typeof TIPS !== "undefined" && Array.isArray(TIPS)) return TIPS; } catch (err) {}
    return [];
  }

  const slugOf = () => (typeof tipSlug === "function" ? tipSlug : null);

  function getFixBySlug(slug) {
    if (!slug || typeof slug !== "string") return null;
    for (const t of tips()) {
      try { if (tipSlug(t.title) === slug) return t; } catch (err) { continue; }
    }
    return null;
  }

  function fixHref(tip) {
    const s = slugOf();
    if (!tip || !s) return "#";
    return `${tip.cat === "mac" ? "mac.html" : "windows.html"}#${s(tip.title)}`;
  }

  /* ---------- Ranking (same shape as Phase 1 global search, §10) ---------- */
  const STOPWORDS = new Set(("a an the i it its of to in on for with and or but that this these those is are was were be been being have has had do does did not no yes really very much more most so such when where what which who how why you your we our they their there here then than too also just only own same as into out up down off over under again further once about against between through during before after above below").split(/\s+/).filter(Boolean));

  function tokenize(query) {
    return normalize(query).split(/[^a-z0-9]+/).filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  }

  /* Rank the fix library for a query. Returns [{tip, slug, score}] best first. */
  function searchKnowledgeBase(opts) {
    const o = opts || {};
    const all = tips();
    if (!all.length) return [];
    const q = normalize(o.query);
    const tokens = expandTokens(tokenize(q));
    if (!tokens.length) return [];

    const hits = [];
    for (const tip of all) {
      let title, desc;
      try { title = tip.title.toLowerCase(); desc = (tip.description || "").toLowerCase(); } catch (err) { continue; }
      let score = 0;
      for (const tok of tokens) {
        if (title.indexOf(tok) !== -1) score += 3;
        else if (desc.indexOf(tok) !== -1) score += 2;
        // Platform words rank the right OS higher, even on their own.
        const isMacTip = tip.cat === "mac";
        if (/^mac/.test(tok) && isMacTip) score += 2;
        if ((tok === "windows" || tok === "win") && !isMacTip) score += 2;
      }
      // Whole-phrase bonus: "slow laptop" beats scattered single-word hits.
      if (q.length > 3) {
        if (title.indexOf(q) !== -1) score += 4;
        else if (desc.indexOf(q) !== -1) score += 2;
      }
      // Gentle platform bias when the caller already knows the OS.
      if (o.platform === "mac" && tip.cat === "mac") score += 1;
      if (o.platform === "windows" && tip.cat !== "mac") score += 1;
      if (score > 0) hits.push({ tip, slug: null, score });
    }

    const s = slugOf();
    hits.sort((a, b) => b.score - a.score || a.tip.title.localeCompare(b.tip.title));
    return hits.slice(0, o.limit || 6).map((h) => Object.assign({}, h, { slug: s ? s(h.tip.title) : null }));
  }

  /* ---------- Session-aware retrieval (§8/§40) ----------
     The current user message is often just an answer to a question
     ("Not sure", "Yes") — ranked alone it retrieves nothing relevant, and
     the model then has no valid fix ids in context for what it wants to say.
     So rank by stable signals (problem summary + original description +
     category vocabulary), then merge in the active topic from the most
     recent AI question so fixes for where the conversation moved (e.g. heat)
     are always visible. */
  function searchForSession(o) {
    const o2 = o || {};
    const platform = o2.platform || null;
    const limit = Math.max(3, Number(o2.limit) || 6);

    const coreParts = [];
    if (o2.summary) coreParts.push(String(o2.summary));
    if (o2.description) coreParts.push(String(o2.description));
    const cw = o2.category ? CATEGORY_WORDS[o2.category] : null;
    if (Array.isArray(cw) && cw.length) coreParts.push(cw.join(" "));

    let hits = [];
    if (coreParts.length) {
      try { hits = searchKnowledgeBase({ query: coreParts.join(" "), platform, limit }); } catch (err) {}
    }

    const topic = typeof o2.topic === "string" ? o2.topic.trim() : "";
    if (topic.length >= 15) {
      let topicHits = [];
      try { topicHits = searchKnowledgeBase({ query: topic, platform, limit: 3 }); } catch (err) {}
      const seen = new Set(hits.map((h) => h.tip.title));
      for (const t of topicHits) if (!seen.has(t.tip.title)) hits.push(t);
    }

    return hits.slice(0, o2.topic ? limit + 3 : limit); // small context (§40)
  }

  /* ---------- Local platform/category classification (deterministic) ----------
     The word lists live in classification-words.js — ONE canonical source
     shared with the worker's pre-AI router (Phase 3.2.1 §15). If that file
     is missing, classification degrades to "unknown" instead of forking a
     second copy: the Qwen path still works and the worker keeps its own.
     Add/fix words in classification-words.js, never here. */
  function sharedWords() {
    try { if (window && window.EmTechClassificationWords) return window.EmTechClassificationWords; } catch (err) {}
    return null;
  }

  const W = sharedWords();
  const PLATFORM_WORDS = (W && W.PLATFORM_WORDS) || {};
  const CATEGORY_WORDS = (W && W.CATEGORY_WORDS) || {};

  /* Best-effort local read of platform + category from free text.
     Used to (a) bias retrieval before the first AI call and (b) feed the
     Phase 2 fallback engine when Qwen is unavailable (§57/§58).
     Multi-word phrases weigh more than single words, so "running out of
     space" beats a stray "slow" — the router picks the real branch. */
  function classifyProblem(text) {
    const q = " " + normalize(text) + " ";
    let platform = null;
    for (const p of ["mac", "windows"]) {
      if ((PLATFORM_WORDS[p] || []).some((w) => q.indexOf(w) !== -1)) { platform = p; break; }
    }

    let category = null, best = 0;
    for (const catId of Object.keys(CATEGORY_WORDS)) {
      let score = 0;
      for (const w of CATEGORY_WORDS[catId]) {
        if (q.indexOf(w) !== -1) score += w.split(" ").length; // phrase weight
      }
      if (score > best) { best = score; category = catId; }
    }

    return { platform, category: best >= 1 ? category : null };
  }

  /* ---------- Knowledge context block for Qwen (§15) ---------- */
  function buildKnowledgeContext(hits, opts) {
    const o = opts || {};
    const list = (hits || []).slice(0, o.maxTips || 6);
    if (!list.length) return "EMTECH KNOWLEDGE\n(no verified fixes matched this problem yet)\n";

    let out = "EMTECH KNOWLEDGE — verified EmTech Media troubleshooting entries. These are the ONLY procedures you may recommend.\n\n";
    for (const h of list) {
      const t = h.tip;
      const os = t.cat === "mac" ? "macOS" : (t.win || "Windows");
      out += `Problem:\n${t.title}\n`;
      out += `Platform:\n${os}\n`;
      out += `Fix id: ${h.slug}\n`;
      if (t.description) out += `Symptoms / what it fixes:\n- ${t.description}\n`;
      if (Array.isArray(t.steps) && t.steps.length) {
        out += "Verified steps:\n" + t.steps.map((s, i) => `${i + 1}. ${s}`).join("\n") + "\n";
      }
      /* Phase 3.2.1 safety metadata (optional per tip; server-owned data —
         Qwen may reference it, never invent it). Labels deliberately do not
         collide with policy.js extractClientContext fact lines. */
      if (t.risk_level) out += `Safety risk:\n${t.risk_level}\n`;
      if (t.verification) out += `How to verify it worked:\n- ${t.verification}\n`;
      if (t.failure_conditions) out += `If it does not work:\n- ${t.failure_conditions}\n`;
      out += `\n`;
    }
    return out;
  }

  /* ---------- Approved question library (§22/§23) ---------- */
  function diagData() {
    try { if (window && window.EMTECH_DIAG_DATA) return window.EMTECH_DIAG_DATA; } catch (err) {}
    return null;
  }

  /* Questions the AI is allowed to ask for a platform+category, from the
     Phase 2 question bank. `asked` ids are filtered out (§25). */
  function approvedQuestions(platform, category, asked) {
    const D = diagData();
    if (!D || !Array.isArray(D.profiles)) return [];
    const device = platform === "mac" ? "mac" : platform === "windows" ? "windows" : null;
    const profile = (category && device)
      ? D.profiles.find((p) => p.category === category && p.devices.includes(device))
      : null;
    if (!profile) return [];

    const skip = new Set(asked || []);
    const out = [];
    for (const qid of profile.questions) {
      if (skip.has(qid)) continue;
      const q = D.questions[qid];
      if (!q) continue;
      out.push({
        id: qid,
        text: q.q,
        options: (q.options || []).map((o) => ({ label: o.label, value: o.value })),
      });
    }
    return out;
  }

  /* The full question bank (union across all profiles) — used on early
     turns before platform/category are known, and as the validation
     universe so branch questions never get rejected by mistake. */
  function allApprovedQuestions() {
    const D = diagData();
    if (!D || !Array.isArray(D.profiles)) return [];
    const seen = new Set();
    const out = [];
    for (const p of D.profiles) {
      for (const qid of p.questions || []) {
        if (seen.has(qid)) continue;
        const q = D.questions[qid];
        if (!q) continue;
        seen.add(qid);
        out.push({ id: qid, text: q.q, options: (q.options || []).map((o) => ({ label: o.label, value: o.value })) });
      }
    }
    return out;
  }

  /* Cause labels + fix ids for a platform+category — lets the AI name
     candidate causes that map to real fixes. */
  function approvedCauses(platform, category) {
    const D = diagData();
    if (!D || !Array.isArray(D.profiles)) return [];
    const device = platform === "mac" ? "mac" : platform === "windows" ? "windows" : null;
    const profile = (category && device)
      ? D.profiles.find((p) => p.category === category && p.devices.includes(device))
      : null;
    if (!profile) return [];
    return (profile.causes || []).map((c) => ({ id: c.id, label: c.label, fixId: c.fix }));
  }

  window.EmTechAIKnowledge = {
    version: VERSION,
    normalize,
    tokenize,
    getFixBySlug,
    fixHref,
    searchKnowledgeBase,
    searchForSession,
    classifyProblem,
    buildKnowledgeContext,
    approvedQuestions,
    allApprovedQuestions,
    approvedCauses,
  };
})();
