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

export { TIPS, tipSlugFn as tipSlug, getFixBySlug, isMacTip, approvedQuestionIds };
