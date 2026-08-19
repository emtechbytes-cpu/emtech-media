/* ============================================================
   EmTech AI API — knowledge schema + data quality tests (Phase 3.2.1 §21)

   Runs in plain Node against the SAME files the browser and worker use
   (tips-data.js / diag-data.js / classification-words.js via their CJS
   shims), so one knowledge base is verified across both runtimes:

     node --test ai-api/test/schema.test.mjs

   Covers §21 items 1–12 (unique fix ids, cause→fix references, valid
   platforms/categories/risk levels/difficulty/time, boolean reversible,
   verification + failure conditions, all 80 fixes accessible — Phase 3.2.2A
   baseline: the original 74 plus 6 new Windows P0 tips) plus a regression
   guard that every one of the ORIGINAL 74 fix ids still resolves, and
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

/* ---------- Phase 3.2.2A regression guard -------------------------------
   The 74 fix ids that existed before the Windows P0 expansion (Phase 3.2.1
   baseline). A title change silently changes a tip's slug — this list pins
   every pre-existing id so any accidental rename fails loudly here instead
   of breaking live links, worker validation or saved sessions. */
const ORIGINAL_74 = [
    "back-up-properly-3-2-1-rule",
    "check-for-driver-updates-in-the-right-order",
    "check-whether-your-pc-can-run-windows-11",
    "clean-up-temp-files-and-browser-cache-properly",
    "create-a-local-account-that-doesn-t-phone-home",
    "disable-startup-bloat",
    "dodge-bundleware-when-you-install-anything",
    "fix-a-blue-screen-bsod-without-panicking",
    "fix-a-hot-pc-for-good-the-airflow-pass",
    "fix-a-mac-that-won-t-start-up",
    "fix-a-microphone-no-one-can-hear",
    "fix-a-pc-that-overheats-and-fans-like-a-jet-engine",
    "fix-a-pc-that-won-t-start-up",
    "fix-a-printer-that-won-t-print",
    "fix-a-webcam-that-won-t-turn-on",
    "fix-my-pc-is-slow-all-of-a-sudden-the-order-of-attack",
    "fix-slow-wi-fi-on-your-mac",
    "force-quit-a-frozen-app",
    "free-up-disk-space-with-storage-management",
    "get-back-a-file-you-deleted-by-mistake",
    "give-safari-a-proper-clean-out",
    "hardening-accounts-updates-and-the-firewall",
    "hunt-down-memory-hogs",
    "install-powertoys-microsoft-s-free-utility-pack",
    "keep-10-of-your-disk-free",
    "keep-macos-updated-the-safe-way",
    "keep-your-mac-battery-healthy",
    "kill-shady-pc-optimizer-software",
    "know-your-bios-settings-the-5-that-matter",
    "let-windows-storage-sense-do-the-work-for-you",
    "lock-down-your-home-wi-fi-properly",
    "lower-windows-transparency-and-animation-effects",
    "make-big-file-transfers-actually-fast",
    "make-windows-search-actually-useful-again",
    "make-your-desktop-feel-like-a-mac-without-the-price",
    "make-your-laptop-battery-last-longer",
    "master-the-keyboard-shortcuts-that-save-hours",
    "move-everything-to-a-new-pc",
    "move-your-os-or-games-to-an-ssd",
    "no-sound-the-four-minute-fix",
    "open-apps-blocked-by-gatekeeper",
    "organise-your-work-with-virtual-desktops",
    "pick-an-ssd-that-s-actually-fast",
    "protect-against-ransomware-before-it-s-too-late",
    "raise-your-effective-fps-with-windows-game-mode",
    "reduce-input-lag-in-competitive-games",
    "repair-corrupted-system-files",
    "reset-nvram-when-things-misbehave",
    "run-a-disk-health-check-before-it-s-too-late",
    "run-drive-optimization-the-safe-way",
    "run-first-aid-on-external-drives",
    "save-your-games-the-right-way",
    "set-up-time-machine-properly",
    "size-your-psu-before-the-next-upgrade",
    "skip-paid-antivirus-and-keep-defender-sharp",
    "slow-internet-run-the-five-minute-test",
    "speed-up-a-sluggish-macbook",
    "spot-a-phishing-email-before-you-click",
    "start-windows-in-safe-mode",
    "stop-apps-from-launching-at-login",
    "stop-emailing-passwords-and-secrets",
    "stop-games-stuttering-the-5-point-checklist",
    "stop-windows-tracking-your-location",
    "stop-windows-updates-at-odd-hours",
    "stop-your-pc-from-sleep-glitching-your-network",
    "switch-the-power-plan-to-best-performance",
    "tame-spotlight-indexing-on-extra-drives",
    "tighten-up-chrome-the-10-minute-pass",
    "tighten-up-edge-and-firefox",
    "turn-on-filevault-full-disk-encryption",
    "turn-on-full-disk-encryption-bitlocker",
    "uninstall-the-apps-you-never-use",
    "upgrade-your-ram-and-match-it",
    "windows-10-is-past-end-of-support-what-to-do-now",
];

/* ---------- 1. fixes: count, unique ids, accessibility (§21.1/§21.11) ---- */
test("all 89 fixes remain accessible with unique fix ids (74 original + 6 P0 + 2 Phase 3.2.2B + 4 Phase 3.2.3 macOS + 3 Phase 3.3)", () => {
  assert.equal(TIPS.length, 89, `Phase 3.3 baseline is 89 tips (got ${TIPS.length})`);
  const slugs = TIPS.map((t) => tipSlug(t.title));
  assert.equal(new Set(slugs).size, slugs.length, "fix ids (slugs) must be unique");
  for (const s of slugs) {
    const t = getFixBySlug(s);
    assert.ok(t && typeof t.title === "string", `getFixBySlug("${s}") must resolve`);
  }
});

/* ---------- 1b. Phase 3.2.2A regression guard: original 74 ids intact ---- */
test("every one of the original 74 fix ids still resolves (no silent renames)", () => {
  const missing = ORIGINAL_74.filter((s) => !getFixBySlug(s));
  assert.deepEqual(missing, [], "original fix ids no longer resolve: " + missing.join(", "));
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
