/* ============================================================
   EmTech AI API — knowledge schema + data quality tests (Phase 3.2.1 §21)

   Runs in plain Node against the SAME files the browser and worker use
   (tips-data.js / diag-data.js / classification-words.js via their CJS
   shims), so one knowledge base is verified across both runtimes:

     node --test ai-api/test/schema.test.mjs

   Covers §21 items 1–12 (unique fix ids, cause→fix references, valid
   platforms/categories/risk levels/difficulty/time, boolean reversible,
   verification + failure conditions, all 74 fixes accessible) plus the
   Phase 3.2.1 §15 router-vocabulary drift check: the worker's pre-AI
   router and the browser classifier must share ONE canonical word list
   (classification-words.js), not two drifting copies.

   REVIEW_QUEUE (§23): temporary quality-control metadata for tips whose
   safety fields could not be safely derived from their own content. It is
   NOT a second knowledge base — it only relaxes the completeness check for
   listed tips, and every entry must name the missing fields + why.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";

import { TIPS, tipSlug, getFixBySlug } from "../src/knowledge.js";
import diagModule from "../../diag-data.js";
import wordsModule from "../../classification-words.js";
import { routerVocabulary } from "../src/policy.js";

/* ---------- interop-safe access (same pattern as src/knowledge.js) ---------- */
function pick(mod, key) {
  if (!mod || typeof mod !== "object") return null;
  const direct = mod[key];
  if (direct !== undefined) return direct;
  const wrapped = mod.default && mod.default[key];
  return wrapped !== undefined ? wrapped : null;
}

const DIAG = diagModule && (diagModule.profiles || diagModule.questions)
  ? diagModule
  : (diagModule && diagModule.default && (diagModule.default.profiles || diagModule.default.questions))
    ? diagModule.default
    : null;

const WORDS = wordsModule && typeof wordsModule === "object"
  ? (wordsModule.PLATFORM_WORDS ? wordsModule : (wordsModule.default || {}))
  : {};

/* ---------- §23 review queue (temporary QC metadata, not a KB) ----------
   Currently EMPTY: every one of the 74 tips carries complete safety
   metadata derived from its own content. When a future tip is added
   without full evidence for a field, list it here instead of guessing:

   const REVIEW_QUEUE = [
     { fix_id: "example-tip", missing: ["verification"], reason: "Steps do not establish a reliable check." },
   ];
------------------------------------------------------------------------- */
const REVIEW_QUEUE = [];

/* Documented in the tips-data.js header — the content categories. */
const VALID_CATS = new Set(["mac", "speed", "windows", "gaming", "cleaning", "maintenance", "hardware", "security"]);
const VALID_RISK = new Set(["low", "medium", "high"]);
const REQUIRED_FIELDS = ["risk_level", "reversible", "verification", "failure_conditions"];

/* ---------- 1. fixes: count, unique ids, accessibility (§21.1/§21.11) ---- */
test("all 74 existing fixes remain accessible with unique fix ids", () => {
  assert.equal(TIPS.length, 74, `baseline library is 74 tips (got ${TIPS.length})`);
  const slugs = TIPS.map((t) => tipSlug(t.title));
  assert.equal(new Set(slugs).size, slugs.length, "fix ids (slugs) must be unique");
  for (const s of slugs) {
    const t = getFixBySlug(s);
    assert.ok(t && typeof t.title === "string", `getFixBySlug("${s}") must resolve`);
  }
});

/* ---------- 2. cause → fix references: zero broken (§21.2/§12) ---------- */
test("every cause→fix reference resolves (0 broken)", () => {
  assert.ok(DIAG && Array.isArray(DIAG.profiles), "diag-data.js must load with profiles");
  const slugs = new Set(TIPS.map((t) => tipSlug(t.title)));
  let refs = 0, broken = [];
  for (const p of DIAG.profiles) {
    for (const c of p.causes || []) {
      if (c.fix) { refs++; if (!slugs.has(c.fix)) broken.push(`${p.id}/${c.id} → ${c.fix}`); }
      for (const a of c.alt || []) { refs++; if (!slugs.has(a)) broken.push(`${p.id}/${c.id} alt → ${a}`); }
    }
  }
  assert.ok(refs >= 54, `expected the verified baseline of ≥54 cause→fix references, got ${refs}`);
  assert.deepEqual(broken, [], "broken cause→fix references: " + broken.join(", "));
});

test("every profile question id resolves in the approved bank", () => {
  const bad = [];
  for (const p of DIAG.profiles || []) {
    for (const qid of p.questions || []) if (!DIAG.questions[qid]) bad.push(`${p.id} → ${qid}`);
  }
  assert.deepEqual(bad, [], "unresolved profile→question refs: " + bad.join(", "));
});

/* ---------- 3. platforms + categories valid (§21.3/§21.4) --------------- */
test("every tip has a valid platform (cat) and content category", () => {
  const bad = [];
  for (const t of TIPS) {
    if (!VALID_CATS.has(t.cat)) bad.push(`${t.title}: cat="${t.cat}"`);
  }
  assert.deepEqual(bad, [], "invalid categories: " + bad.join(", "));
  // Platform separation must remain real: both sides present.
  assert.ok(TIPS.some((t) => t.cat === "mac"), "expected macOS tips");
  assert.ok(TIPS.some((t) => t.cat !== "mac"), "expected Windows-side tips");
});

/* ---------- 4. difficulty + estimated time valid (§21.6/§21.8) ----------- */
test("difficulty and time are well-formed on every tip", () => {
  const bad = [];
  for (const t of TIPS) {
    if (![1, 2, 3].includes(t.difficulty)) bad.push(`${t.title}: difficulty=${JSON.stringify(t.difficulty)}`);
    if (typeof t.time !== "string" || !t.time.trim()) bad.push(`${t.title}: time missing`);
  }
  assert.deepEqual(bad, [], bad.join("; "));
});

/* ---------- 5. safety metadata: types where present (§21.5/7/9/10) ------- */
test("risk_level / reversible / verification / failure_conditions are well-formed", () => {
  const bad = [];
  for (const t of TIPS) {
    if (t.risk_level !== undefined && !VALID_RISK.has(t.risk_level)) bad.push(`${t.title}: risk_level=${JSON.stringify(t.risk_level)}`);
    if (t.reversible !== undefined && typeof t.reversible !== "boolean") bad.push(`${t.title}: reversible not boolean`);
    for (const f of ["verification", "failure_conditions"]) {
      if (t[f] !== undefined && (typeof t[f] !== "string" || !t[f].trim())) bad.push(`${t.title}: ${f} empty/invalid`);
    }
  }
  assert.deepEqual(bad, [], bad.join("; "));
});

/* ---------- 6. completeness: full metadata or an explicit review entry ---- */
test("every tip has complete safety metadata (or a REVIEW_QUEUE entry)", () => {
  const queued = new Map(REVIEW_QUEUE.map((e) => [e.fix_id, e]));
  for (const e of REVIEW_QUEUE) {
    assert.ok(Array.isArray(e.missing) && e.missing.length, "REVIEW_QUEUE entries must list missing fields");
    assert.ok(typeof e.reason === "string" && e.reason.trim(), "REVIEW_QUEUE entries must state why");
  }
  const bad = [];
  for (const t of TIPS) {
    const slug = tipSlug(t.title);
    const entry = queued.get(slug);
    if (entry) continue; // explicitly deferred — allowed, tracked
    for (const f of REQUIRED_FIELDS) {
      if (t[f] === undefined) bad.push(`${slug}: missing ${f}`);
    }
  }
  assert.deepEqual(bad, [], "incomplete metadata without a review entry: " + bad.join("; "));
});

/* ---------- 7. §15 router vocabulary drift check -------------------------- */
test("worker router and browser classifier share ONE canonical word list", () => {
  const shared = WORDS.PLATFORM_WORDS && WORDS.CATEGORY_WORDS ? WORDS : null;
  assert.ok(shared, "classification-words.js must expose PLATFORM_WORDS + CATEGORY_WORDS");

  const vocab = routerVocabulary();
  assert.ok(vocab && vocab.platform && vocab.category, "policy.routerVocabulary() must expose both lists");

  // Semantic comparison: same keys, same words (order within a list has no
  // effect on either classifier — both do substring scans).
  const asSet = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, [...(o[k] || [])].sort()]));
  assert.deepEqual(asSet(vocab.platform), asSet(shared.PLATFORM_WORDS), "platform word lists drifted");
  assert.deepEqual(asSet(vocab.category), asSet(shared.CATEGORY_WORDS), "category word lists drifted");

  // Sanity: the shared list is non-trivial (a regression to an empty file
  // would silently disable deterministic routing on both runtimes).
  assert.ok(Object.keys(shared.PLATFORM_WORDS).length >= 2, "expected mac + windows platform words");
  assert.ok(Object.keys(shared.CATEGORY_WORDS).length >= 5, "expected the real category word set");
});
