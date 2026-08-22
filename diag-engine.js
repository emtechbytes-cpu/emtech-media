/* ============================================================
   EmTech Media — Phase 2 diagnostic ENGINE (pure logic, no DOM)

   Reads window.EMTECH_DIAG_DATA (diag-data.js) and TIPS/tipSlug
   (tips-data.js). Exposes window.EmTechDiag: a deterministic
   troubleshooting engine plus the shared localStorage service used
   by diagnose.html AND the fix pages' feedback banner.

   Architecture note (Phase 3+): everything the UI needs goes through
   this API. A future AI classification layer only has to provide an
   `analyze(state)` with the same return shape — no UI rebuild.

   Design rules:
     * Scoring is always recomputed from scratch (answers + keywords).
       No add/subtract bookkeeping, so Back/forward can never drift.
     * Nothing here touches document/window DOM APIs; localStorage is
       wrapped in try/catch so private mode or corrupted data degrades
       to "no persistence" instead of an error (§27).
     * User text is only ever stored as plain strings — the UI escapes
       it before rendering (§48).
   ============================================================ */

(function () {
  "use strict";

  const DATA = window.EMTECH_DIAG_DATA;
  if (!DATA || !Array.isArray(DATA.profiles)) return; // data layer missing → stay silent

  /* ---------- Tunables (kept next to the logic they shape) ---------- */
  const KEYWORD_CAP = 4;          // max keyword points per cause — questions must dominate (§30)
  const SEARCH_LIST_MIN = 4;      // weakest top-hit score still worth showing as "potentially relevant"
  const SEARCH_RECOMMEND_MIN = 6; // "something-else" hit score needed before we call it THE fix

  /* Stopwords: filtering them keeps nonsense queries ("my toaster is making a
     weird noise") from scoring off filler words like "my". */
  const STOPWORDS = new Set(("a an the i it its of to in on for with and or but that this these those is are was were be been being have has had do does did not no yes really very much more most so such when where what which who whom how why you your we our they their there here then than too also just only own same as into out up down off over under again further once about against between through during before after above below while because until if else every all any both few some other another my me us them he she him her its itself himself herself ourselves yourselves themselves am was were would could should may might must shall can will let's doesn't didn't isn't aren't wasn't weren't won't wouldn't couldn't shouldn't")
    .split(/\s+/).filter(Boolean));
  const HISTORY_MAX = 8;          // recent-diagnoses list length (§26)
  const DESCRIPTION_MAX = 500;    // hard cap on free-text input

  const SESSION_KEY = "emtech-diag-session-v1";
  const HISTORY_KEY = "emtech-diag-history-v1";

  /* ============================================================
     Small utilities
     ============================================================ */
  function uid() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }
  const nowIso = () => new Date().toISOString();

  function dedupe(arr) {
    return Array.from(new Set(arr.filter(Boolean)));
  }

  /* ============================================================
     State shape (v1)
     {
       v: 1, id, startedAt, updatedAt,
       device: "windows"|"mac"|"other"|null,
       category: string|null,            // "something-else" = free-text search path
       description: "", descSkipped: false,
       answers: {},                      // questionId -> option value
       askedOrder: [],                   // answer order (drives Back + reason order)
       triedFixes: [],                   // slugs the user already attempted (§20 loop)
       round: 1,                         // increments per failed-fix cycle
       status: "in-progress"|"result"|"awaiting-feedback"|"solved"|"abandoned",
       activeFix: null,                  // slug we're waiting on feedback for
       result: null                      // last analyze() output (for resume display)
     }
     ============================================================ */
  const VALID_STATUS = ["in-progress", "result", "awaiting-feedback", "solved", "abandoned"];

  function freshSession(preselect) {
    const s = {
      v: 1, id: uid(), startedAt: nowIso(), updatedAt: nowIso(),
      device: null, category: null,
      description: "", descSkipped: false,
      answers: {}, askedOrder: [], triedFixes: [], round: 1,
      status: "in-progress", activeFix: null, result: null,
    };
    if (preselect && typeof preselect === "object") {
      const dev = validDeviceId(preselect.device);
      if (dev) s.device = dev;
      const cat = validCategoryId(preselect.category);
      if (cat && deviceOffersCategory(s.device, cat)) s.category = cat;
    }
    return s;
  }

  function validDeviceId(id) {
    return DATA.devices.some((d) => d.id === id) ? id : null;
  }
  function validCategoryId(id) {
    return DATA.categories.some((c) => c.id === id) ? id : null;
  }
  function deviceOffersCategory(device, categoryId) {
    const cat = DATA.categories.find((c) => c.id === categoryId);
    if (!cat) return false;
    if (device && !cat.platforms.includes(device)) return false;
    // A category is only offered when a real profile sits behind it (§5).
    if (categoryId !== "something-else") {
      const hasProfile = DATA.profiles.some(
        (p) => p.category === categoryId && (!device || p.devices.includes(device))
      );
      if (!hasProfile) return false;
    }
    return true;
  }

  /* ---------- Sanitize a persisted state object (§27/§36) ---------- */
  function validateState(s) {
    try {
      if (!s || typeof s !== "object" || s.v !== 1 || typeof s.id !== "string") return null;
      const out = freshSession(null);
      out.id = s.id;

      if (typeof s.startedAt === "string") out.startedAt = s.startedAt;
      if (typeof s.updatedAt === "string") out.updatedAt = s.updatedAt;

      const dev = validDeviceId(s.device);
      if (dev) {
        out.device = dev;
        const cat = validCategoryId(s.category);
        if (cat && deviceOffersCategory(dev, cat)) out.category = cat;
      }

      if (typeof s.description === "string") out.description = s.description.slice(0, DESCRIPTION_MAX);
      out.descSkipped = s.descSkipped === true;

      // Keep only answers that are real question ids with real option values.
      const cleanAnswers = {};
      for (const qid of Object.keys(s.answers || {})) {
        const q = DATA.questions[qid];
        if (!q) continue;
        const val = s.answers[qid];
        if (q.options.some((o) => o.value === val)) cleanAnswers[qid] = val;
      }
      out.answers = cleanAnswers;
      out.askedOrder = Array.isArray(s.askedOrder)
        ? s.askedOrder.filter((qid) => cleanAnswers[qid] !== undefined)
        : Object.keys(cleanAnswers);

      if (Array.isArray(s.triedFixes)) {
        out.triedFixes = dedupe(s.triedFixes.map(String).filter(Boolean)).slice(0, 20);
      }
      out.round = Number.isInteger(s.round) && s.round >= 1 ? Math.min(s.round, 10) : 1;

      if (VALID_STATUS.includes(s.status)) {
        out.status = s.status;
        if (typeof s.activeFix === "string") out.activeFix = s.activeFix.slice(0, 200);
        if (s.result && typeof s.result === "object" && !Array.isArray(s.result)) {
          // Keep only the fields the UI actually renders.
          const r = {};
          for (const k of ["mode", "status", "confidence", "primary", "reasons", "recommendedFix", "alternativeFixes"]) {
            if (k in s.result) r[k] = s.result[k];
          }
          out.result = r;
        }
      }

      // Consistency: a terminal status with no result is fine (abandoned),
      // but awaiting-feedback without an active fix is not — downgrade it.
      if (out.status === "awaiting-feedback" && !out.activeFix) out.status = "in-progress";
      return out;
    } catch (err) {
      return null; // corrupted → start fresh rather than crash (§36)
    }
  }

  /* ============================================================
     Question helpers
     ============================================================ */
  function getProfile(state) {
    if (!state || !state.device || !state.category || state.category === "something-else") return null;
    return (
      DATA.profiles.find(
        (p) => p.category === state.category && p.devices.includes(state.device)
      ) || null
    );
  }

  function questionVisible(q, answers) {
    if (!q.showIf) return true;
    const a = answers[q.showIf.q];
    return Array.isArray(q.showIf.is) ? q.showIf.is.indexOf(a) !== -1 : a === q.showIf.is;
  }

  /* Drop answers to questions that are no longer visible (their showIf
     condition changed after a Back + re-answer). Deterministic: scores
     are always recomputed from what's left. */
  function pruneStale(state) {
    for (const qid of Object.keys(state.answers)) {
      const q = DATA.questions[qid];
      if (!q || !questionVisible(q, state.answers)) delete state.answers[qid];
    }
    state.askedOrder = state.askedOrder.filter((qid) => state.answers[qid] !== undefined);
  }

  function nextQuestion(state) {
    const profile = getProfile(state);
    if (!profile) return null;
    for (const qid of profile.questions) {
      if (state.answers[qid] !== undefined) continue;
      const q = DATA.questions[qid];
      if (!q || !questionVisible(q, state.answers)) continue;
      return Object.assign({ id: qid }, q);
    }
    return null;
  }

  /* ============================================================
     Scoring — recomputed from scratch on every call (§30)
     ============================================================ */
  function keywordScores(profile, description) {
    const text = " " + String(description || "").toLowerCase() + " ";
    const scores = {};
    for (const cause of profile.causes) {
      let s = 0;
      for (const kw of cause.keywords || []) {
        if (!kw || text.indexOf(kw.toLowerCase()) === -1) continue;
        s += String(kw).indexOf(" ") !== -1 ? 2 : 1; // phrases weigh more than words
      }
      scores[cause.id] = Math.min(s, KEYWORD_CAP);
    }
    return scores;
  }

  function questionScores(profile, answers) {
    const scores = {};
    for (const cause of profile.causes) scores[cause.id] = 0;
    for (const qid of Object.keys(answers)) {
      const q = DATA.questions[qid];
      if (!q || !questionVisible(q, answers)) continue; // stale → contributes nothing
      const opt = q.options.find((o) => o.value === answers[qid]);
      if (!opt || !opt.score) continue;
      for (const causeId of Object.keys(opt.score)) {
        if (scores[causeId] !== undefined) scores[causeId] += opt.score[causeId];
      }
    }
    return scores;
  }

  function rankCauses(state) {
    const profile = getProfile(state);
    if (!profile) return [];
    const kw = keywordScores(profile, state.description);
    const qs = questionScores(profile, state.answers);
    return profile.causes
      .map((c) => ({ cause: c, score: (kw[c.id] || 0) + (qs[c.id] || 0) }))
      .sort((a, b) => b.score - a.score || a.cause.id.localeCompare(b.cause.id));
  }

  function confidenceFor(topScore, secondScore) {
    const t = DATA.confidence;
    if (topScore >= t.highMin && topScore - secondScore >= t.highMargin) return "high";
    if (topScore >= t.mediumMin) return "medium";
    return null; // not enough signal — never fake confidence (§17/§40)
  }

  /* Reasons shown under "Why we think this" — only statements backed by
     what the user actually answered or typed (§16). */
  function reasonsFor(state, causeId) {
    const profile = getProfile(state);
    if (!profile) return [];
    const cause = profile.causes.find((c) => c.id === causeId);
    const out = [];

    for (const qid of state.askedOrder) {
      const q = DATA.questions[qid];
      if (!q || !questionVisible(q, state.answers)) continue;
      const opt = q.options.find((o) => o.value === state.answers[qid]);
      if (opt && (opt.score || {})[causeId] > 0 && opt.reason) out.push(opt.reason);
    }

    if (state.description && cause) {
      const text = state.description.toLowerCase();
      const hits = (cause.keywords || [])
        .filter((k) => k && text.indexOf(k.toLowerCase()) !== -1)
        .slice(0, 3);
      if (hits.length) {
        out.push("Your description mentioned " + hits.map((h) => "\u201C" + h + "\u201D").join(", ") + ".");
      }
    }
    return out.slice(0, 4);
  }

  /* ============================================================
     Analysis — the one function a future AI layer would replace.
     Pure: reads state, returns a result object, mutates nothing.
     ============================================================ */
  const NO_MATCH = {
    mode: "search", status: "no_match", confidence: null,
    primary: null, reasons: [], recommendedFix: null, alternativeFixes: [],
  };

  /* Phase 3.4 — scoped exhaustion (§8). A cause may declare a `group`
     (e.g. "input" vs "output"). When the top-ranked cause declares one,
     analysis is confined to that group: confidence, untried selection and
     alternatives all stay inside it, so an exhausted microphone branch can
     never leak speaker/output fixes — and vice versa. Profiles whose causes
     declare no group behave exactly as before (Phase 3.2.3 contract). */
  function activeGroup(ranked) {
    const g = ranked[0] && ranked[0].cause.group;
    return typeof g === "string" && g.length ? g : null;
  }

  function analyzeProfile(state) {
    const all = rankCauses(state);
    if (!all.length) return Object.assign({}, NO_MATCH);
    const group = activeGroup(all);
    const ranked = group ? all.filter((r) => r.cause.group === group) : all;

    const top = ranked[0];
    const second = ranked[1] ? ranked[1].score : 0;
    const conf = confidenceFor(top.score, second);
    const untried = ranked.filter((r) => state.triedFixes.indexOf(r.cause.fix) === -1);

    // Every fix in this profile has been attempted (§20 loop exhausted).
    if (!untried.length) {
      return {
        mode: "profile", status: "exhausted", confidence: null,
        primary: top.score > 0 ? { id: top.cause.id, label: top.cause.label } : null,
        reasons: [], recommendedFix: null,
        alternativeFixes: ranked.map((r) => r.cause.fix),
      };
    }

    // Not enough signal to name a cause — offer the field, not a verdict (§22).
    if (conf === null) {
      return {
        mode: "profile", status: "insufficient", confidence: null,
        primary: top.score > 0 ? { id: top.cause.id, label: top.cause.label } : null,
        reasons: [], recommendedFix: null,
        alternativeFixes: untried.slice(0, 4).map((r) => r.cause.fix),
      };
    }

    const chosen = untried[0]; // highest-scoring cause whose fix hasn't been tried
    /* Phase 3.5.2 — platform-safety invariant: a cause that declares no `fix`
       has no safe recommendation to make (e.g. "other"-device causes, where
       every KB fix is Windows- or Mac-specific). Never emit "success" for it;
       resolve to the honest insufficient state instead. The keyword cap (4)
       can exceed mediumMin (3), so this guard — not data alone — enforces it.
       Regression: test/p352-safety.test.mjs. */
    if (!chosen.cause.fix) {
      return {
        mode: "profile", status: "insufficient", confidence: null,
        primary: top.score > 0 ? { id: top.cause.id, label: top.cause.label } : null,
        reasons: [], recommendedFix: null,
        alternativeFixes: untried.slice(0, 4).map((r) => r.cause.fix),
      };
    }

    /* Phase 3.4 — when the profile is grouped, an explicit alt must stay in
       the active group too (no cross-group leak into "alternative fixes"). */
    const inGroup = (slug) => !group || ranked.some((r) => r.cause.fix === slug);
    const alts = [];
    for (const r of untried.slice(1)) if (alts.indexOf(r.cause.fix) === -1) alts.push(r.cause.fix);
    for (const a of chosen.cause.alt || []) {
      if (state.triedFixes.indexOf(a) === -1 && alts.indexOf(a) === -1 && inGroup(a)) alts.push(a);
    }

    return {
      mode: "profile", status: "success", confidence: conf,
      primary: { id: chosen.cause.id, label: chosen.cause.label },
      reasons: reasonsFor(state, chosen.cause.id),
      recommendedFix: chosen.cause.fix,
      alternativeFixes: alts.slice(0, 4),
    };
  }

  /* ---------- "Something else": keyword search across the whole library (§23) ---------- */
  function scoreSearchTip(tip, tokens, phrase, device) {
    const title = tip.title.toLowerCase();
    const desc = (tip.description || "").toLowerCase();
    let s = 0;
    for (const tok of tokens) {
      if (!tok) continue;
      if (title.indexOf(tok) !== -1) s += 3;
      else if (desc.indexOf(tok) !== -1) s += 2;
      const isMacTip = tip.cat === "mac";
      if (/^mac/.test(tok) && isMacTip) s += 2;
      if ((tok === "windows" || tok === "win") && !isMacTip) s += 2;
    }
    if (phrase.length > 3) {
      if (title.indexOf(phrase) !== -1) s += 4;
      else if (desc.indexOf(phrase) !== -1) s += 2;
    }
    // Gentle platform bias so a Mac user's "slow" ranks Mac fixes first.
    if (device === "mac" && tip.cat === "mac") s += 1;
    if (device === "windows" && tip.cat !== "mac") s += 1;
    return s;
  }

  function analyzeSearch(state) {
    // tips-data.js declares `const TIPS` (global lexical scope, not on
    // window) and a top-level `function tipSlug`. Bare references with
    // typeof guards keep this safe even if the data file is missing.
    let tips = null;
    try { if (typeof TIPS !== "undefined") tips = TIPS; } catch (err) {}
    if (!Array.isArray(tips) || typeof tipSlug !== "function") return Object.assign({}, NO_MATCH);

    const q = String(state.description || "").trim().toLowerCase();
    const tokens = q.split(/[^a-z0-9]+/).filter((t) => t.length >= 2 && !STOPWORDS.has(t));
    if (!tokens.length) return Object.assign({}, NO_MATCH);

    const hits = tips.map((tip) => ({ tip, score: scoreSearchTip(tip, tokens, q, state.device) }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score || a.tip.title.localeCompare(b.tip.title))
      .slice(0, 6);

    // Too weak to be "potentially relevant" — say so honestly (§23/§40).
    if (!hits.length || hits[0].score < SEARCH_LIST_MIN) return Object.assign({}, NO_MATCH);

    const slugs = hits.map((h) => tipSlug(h.tip.title));
    if (hits[0].score >= SEARCH_RECOMMEND_MIN) {
      return {
        mode: "search", status: "success", confidence: "medium",
        primary: null, reasons: [], recommendedFix: slugs[0], alternativeFixes: slugs.slice(1),
      };
    }
    // Some signal, no clear winner — show the ranked list without a verdict.
    return {
      mode: "search", status: "success", confidence: null,
      primary: null, reasons: [], recommendedFix: null, alternativeFixes: slugs,
    };
  }

  function analyze(state) {
    try {
      if (!state || !state.device) return Object.assign({}, NO_MATCH);
      if (state.category === "something-else") return analyzeSearch(state);
      const profile = getProfile(state);
      if (!profile) {
        // Defensive: category offered without a profile → fall back to search.
        return state.description ? analyzeSearch(state) : Object.assign({}, NO_MATCH);
      }
      return analyzeProfile(state);
    } catch (err) {
      return Object.assign({}, NO_MATCH); // never let analysis crash the page (§36)
    }
  }

  /* ============================================================
     Mutating session actions — each returns { ok, error? } or a
     richer object where noted. UI persists via EmTechDiag.store.
     ============================================================ */
  function touch(state) { state.updatedAt = nowIso(); }

  function selectDevice(state, id) {
    const dev = validDeviceId(id);
    if (!dev) return { ok: false, error: "unknown device" };
    if (state.device === dev) return { ok: true };
    state.device = dev;
    // Changing platform invalidates everything downstream.
    state.category = null;
    state.description = ""; state.descSkipped = false;
    state.answers = {}; state.askedOrder = [];
    state.triedFixes = []; state.round = 1;
    state.status = "in-progress"; state.activeFix = null; state.result = null;
    touch(state);
    return { ok: true };
  }

  function selectCategory(state, id) {
    const cat = validCategoryId(id);
    if (!cat || !deviceOffersCategory(state.device, cat)) return { ok: false, error: "category not offered for this device" };
    if (state.category === cat) return { ok: true };
    state.category = cat;
    state.description = ""; state.descSkipped = false;
    state.answers = {}; state.askedOrder = [];
    state.triedFixes = []; state.round = 1;
    state.status = "in-progress"; state.activeFix = null; state.result = null;
    touch(state);
    return { ok: true };
  }

  function setDescription(state, text) {
    const clean = String(text == null ? "" : text).trim().slice(0, DESCRIPTION_MAX);
    if (!clean) return { ok: false, error: "empty" };
    state.description = clean;
    state.descSkipped = false;
    touch(state);
    return { ok: true };
  }

  function skipDescription(state) {
    if (state.category === "something-else") return { ok: false, error: "description required" };
    state.description = "";
    state.descSkipped = true;
    touch(state);
    return { ok: true };
  }

  function answer(state, qid, value) {
    const profile = getProfile(state);
    if (!profile || profile.questions.indexOf(qid) === -1) return { ok: false, error: "question not in this flow" };
    const q = DATA.questions[qid];
    if (!q || !questionVisible(q, state.answers)) return { ok: false, error: "question not currently applicable" };
    const opt = q.options.find((o) => o.value === value);
    if (!opt) return { ok: false, error: "unknown option" };

    state.answers[qid] = value;
    if (state.askedOrder.indexOf(qid) === -1) state.askedOrder.push(qid);
    pruneStale(state); // re-answering a showIf parent may retire later answers
    touch(state);
    return { ok: true };
  }

  /* One step back through the whole chain: last question → description
     → category. Downstream state is cleared so nothing stale survives (§13). */
  function goBack(state) {
    if (state.askedOrder.length) {
      const last = state.askedOrder.pop();
      delete state.answers[last];
      pruneStale(state);
    } else if (state.description || state.descSkipped) {
      state.description = "";
      state.descSkipped = false;
    } else if (state.category) {
      state.category = null;
      state.triedFixes = []; state.round = 1;
      state.status = "in-progress"; state.activeFix = null; state.result = null;
    }
    touch(state);
    return currentScreen(state);
  }

  /* ---------- The fix-feedback loop (§20/§45) ---------- */
  function openFix(state, slug) {
    if (!slug || typeof slug !== "string") return { ok: false, error: "no fix" };
    state.status = "awaiting-feedback";
    state.activeFix = slug;
    touch(state);
    return { ok: true };
  }

  function markSolved(state) {
    state.status = "solved";
    touch(state);
    return { ok: true };
  }

  /* User says the fix didn't work. Record it, then either ask the next
     unasked question or re-analyze with that cause excluded (§20). */
  function afterFailedFix(state, slug) {
    if (slug && state.triedFixes.indexOf(slug) === -1) state.triedFixes.push(slug);
    state.round = Math.min((state.round || 1) + 1, 10);
    state.status = "in-progress";
    state.activeFix = null;
    state.result = null;
    touch(state);

    const q = nextQuestion(state);
    if (q) return { status: "continue", nextQuestion: q };
    return analyze(state); // re-ranks with the tried fix excluded
  }

  function abandon(state) {
    state.status = "abandoned";
    touch(state);
    return { ok: true };
  }

  /* ---------- Which screen the UI should render right now ---------- */
  function currentScreen(state) {
    if (!state || !state.device) return "device";
    if (!state.category) return "category";
    const descDone = Boolean(state.description) || state.descSkipped === true;
    if (state.category === "something-else") return descDone ? "result" : "description";
    if (!descDone) return "description";
    return nextQuestion(state) ? "question" : "result";
  }

  /* ============================================================
     Shared localStorage service — used by diagnose.html AND the
     fix pages' feedback banner, so both stay in sync (§25/§46).
     Every call is try/catch-wrapped: private mode or corrupted JSON
     degrades to "no persistence", never an exception (§27).
     ============================================================ */
  const store = {
    loadSession() {
      let raw = null;
      try { raw = window.localStorage.getItem(SESSION_KEY); } catch (err) { return null; }
      if (!raw) return null;
      try { return validateState(JSON.parse(raw)); } catch (err) { return null; }
    },

    saveSession(state) {
      try { window.localStorage.setItem(SESSION_KEY, JSON.stringify(state)); } catch (err) {}
    },

    clearSession() {
      try { window.localStorage.removeItem(SESSION_KEY); } catch (err) {}
    },

    loadHistory() {
      let raw = null;
      try { raw = window.localStorage.getItem(HISTORY_KEY); } catch (err) { return []; }
      if (!raw) return [];
      let list = null;
      try { list = JSON.parse(raw); } catch (err) { return []; }
      if (!Array.isArray(list)) return [];
      // Keep only well-formed entries; drop anything with a bad snapshot.
      return list
        .filter((e) => e && typeof e === "object" && typeof e.id === "string")
        .map((e) => {
          const snap = validateState(e.snapshot);
          if (!snap) return null;
          return {
            id: e.id,
            date: typeof e.date === "string" ? e.date : nowIso(),
            device: snap.device || "",
            category: snap.category || "",
            description: String(e.description || "").slice(0, 120),
            fix: typeof e.fix === "string" ? e.fix : null,
            status: e.status === "solved" ? "solved" : "open",
            snapshot: snap,
          };
        })
        .filter(Boolean)
        .slice(0, HISTORY_MAX);
    },

    saveHistory(list) {
      try { window.localStorage.setItem(HISTORY_KEY, JSON.stringify((list || []).slice(0, HISTORY_MAX))); } catch (err) {}
    },

    /* Upsert the session's history row. Called when a result is reached
       and again when it's solved — newest first, capped at 8 (§26). */
    upsertHistory(state, extra) {
      const list = store.loadHistory();
      const entry = Object.assign(
        {
          id: state.id,
          date: nowIso(),
          device: state.device || "",
          category: state.category || "",
          description: (state.description || "").slice(0, 120),
          fix: null,
          status: "open",
          snapshot: JSON.parse(JSON.stringify(state)),
        },
        extra || {}
      );
      const i = list.findIndex((e) => e.id === entry.id);
      if (i !== -1) {
        // Preserve the original date; merge new fields over the old row.
        entry.date = list[i].date;
        list[i] = Object.assign({}, list[i], entry, { snapshot: JSON.parse(JSON.stringify(state)) });
      } else {
        list.unshift(entry);
      }
      store.saveHistory(list.slice(0, HISTORY_MAX));
    },

    removeHistory(id) {
      const list = store.loadHistory().filter((e) => e.id !== id);
      store.saveHistory(list);
    },
  };

  /* ============================================================
     Analytics hook (§41/§42): in-memory ring buffer only. Nothing is
     transmitted; a future analytics layer can read or subscribe here.
     ============================================================ */
  const EVENT_CAP = 200;
  const events = [];
  function trackEvent(name, payload) {
    try {
      events.push({ t: Date.now(), name: String(name), payload: payload || null });
      if (events.length > EVENT_CAP) events.splice(0, events.length - EVENT_CAP);
    } catch (err) {} // never let telemetry break the flow
  }

  /* ============================================================ */
  window.EmTechDiag = {
    version: "2",
    data: DATA,
    limits: { descriptionMax: DESCRIPTION_MAX, historyMax: HISTORY_MAX },

    newSession: (preselect) => freshSession(preselect),
    validateState,
    currentScreen,
    nextQuestion,
    getProfile,

    selectDevice,
    selectCategory,
    setDescription,
    skipDescription,
    answer,
    goBack,
    analyze,
    openFix,
    markSolved,
    afterFailedFix,
    abandon,
    reset: () => freshSession(null),

    store,
    trackEvent,
  };
})();
