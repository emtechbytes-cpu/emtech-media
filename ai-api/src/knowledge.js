/* ============================================================
   EmTech AI API — knowledge base access (server-side)

   Bundles the site's own data files so validation runs against the exact
   same library that powers search, diagnosis and fix pages (§13/§48):
     ../../tips-data.js  → TIPS + tipSlug     (fix ids)
     ../../diag-data.js  → question bank      (approved question ids)

   Both files carry a tiny CJS export shim at the bottom (a no-op in the
   browser, where `module` is undefined), so they can be imported here
   without duplicating any content. One knowledge base, two runtimes.
   ============================================================ */
import tipsModule from "../../tips-data.js";
import diagModule from "../../diag-data.js";

/* Interop-safe access: depending on the bundler/runtime we may receive
   module.exports directly or wrapped as { default }. */
function pick(mod, key) {
  if (!mod || typeof mod !== "object") return null;
  const direct = mod[key];
  if (direct !== undefined) return direct;
  const wrapped = mod.default && mod.default[key];
  return wrapped !== undefined ? wrapped : null;
}

const TIPS = Array.isArray(pick(tipsModule, "TIPS")) ? pick(tipsModule, "TIPS") : [];
const tipSlugFn = typeof pick(tipsModule, "tipSlug") === "function" ? pick(tipsModule, "tipSlug") : null;

const DIAG = (diagModule && (diagModule.profiles || diagModule.questions))
  ? diagModule
  : (diagModule && diagModule.default && (diagModule.default.profiles || diagModule.default.questions))
    ? diagModule.default
    : null;

/* Find a tip by its URL slug — the same lookup the frontend uses. */
function getFixBySlug(slug) {
  if (!slug || typeof slug !== "string" || !tipSlugFn) return null;
  for (const t of TIPS) {
    try { if (tipSlugFn(t.title) === slug) return t; } catch (err) { continue; }
  }
  return null;
}

function isMacTip(tip) {
  return !!tip && tip.cat === "mac";
}

/* Every question id the AI is allowed to reference (§22/§47). */
function approvedQuestionIds() {
  const ids = new Set();
  if (!DIAG || !Array.isArray(DIAG.profiles) || !DIAG.questions) return ids;
  for (const p of DIAG.profiles) {
    for (const qid of p.questions || []) {
      if (typeof qid === "string" && DIAG.questions[qid]) ids.add(qid);
    }
  }
  return ids;
}

/* Ordered union of every approved question with canonical text/options.
   policy.js uses this as the fallback question list when a client sends no
   usable branch questions. */
function allApprovedQuestions() {
  const out = [];
  if (!DIAG || !Array.isArray(DIAG.profiles) || !DIAG.questions) return out;
  const seen = new Set();
  for (const p of DIAG.profiles) {
    for (const qid of p.questions || []) {
      if (seen.has(qid)) continue;
      const q = DIAG.questions[qid];
      // diag-data.js stores the question text in `q` (frontend reads q.q);
      // accept .text too so a future data rename can't silently empty this.
      const text = typeof q && (typeof q.q === "string" ? q.q : typeof q.text === "string" ? q.text : null);
      if (!text) continue;
      seen.add(qid);
      out.push({ id: qid, text, options: ((q.options || [])).map((o) => ({ label: o.label, value: o.value })) });
    }
  }
  return out;
}

/* First unasked approved question for a platform+category branch — mirrors
   the frontend's ai-knowledge.approvedQuestions() (same data, same lookup).
   Used by the pre-AI router so obvious turns never need a Qwen call.

   Phase 3.5.1 — showIf safety: the client protocol sends only ALREADY-ASKED
   QUESTION IDS ("Already asked: id; id") — never the answer values. The
   frontend can evaluate a question's showIf gate because it holds the user's
   answers; this Worker cannot. A gated candidate therefore has an UNKNOWN
   gate here, and unknown gates are never served deterministically:
   return null so the turn falls through to Qwen with full conversation
   context (which DOES see the answers). We do not guess the answer, assume
   the gate is satisfied, or skip ahead to a later question whose relevance
   also depends on the unknown answer. */
function firstBranchQuestion(platform, category, excludeIds) {
  if (!DIAG || !Array.isArray(DIAG.profiles)) return null;
  const device = platform === "mac" ? "mac" : platform === "windows" ? "windows" : null;
  if (!device || !category) return null;
  const profile = DIAG.profiles.find((p) => p.category === category && Array.isArray(p.devices) && p.devices.indexOf(device) !== -1);
  if (!profile) return null;
  const skip = new Set(excludeIds || []);
  for (const qid of profile.questions || []) {
    if (skip.has(qid)) continue;
    const q = DIAG.questions[qid];
    // Phase 3.5.1 — UNKNOWN GATE = DO NOT SERVE DETERMINISTICALLY.
    if (q && q.showIf) return null; // gate needs an answer value the Worker never receives
    // diag-data.js stores the question text in `q` (frontend reads q.q).
    const text = typeof q && (typeof q.q === "string" ? q.q : typeof q.text === "string" ? q.text : null);
    if (!text) continue;
    return { id: qid, text, options: ((q.options || [])).map((o) => ({ label: o.label, value: o.value })) };
  }
  return null;
}

export { TIPS, tipSlugFn as tipSlug, getFixBySlug, isMacTip, approvedQuestionIds, allApprovedQuestions, firstBranchQuestion };
