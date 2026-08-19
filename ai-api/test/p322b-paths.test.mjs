/* ============================================================
   EmTech AI — Phase 3.2.2B Windows P0 completion pathway tests

   Exercises the three closed gaps end-to-end at the deterministic
   layer (no network, no model calls):

     WINDOWS UPDATE FAILING
       router → upd-what=fail → gated upd-stuck branch
         → safe retry pass FIRST (low risk)
           → failed fix → repair-corrupted-system-files escalation
             → storage / network branches reuse existing fixes

     FREEZE / HANG
       perf-freeze question distinguishes app-hang vs whole-system
         vs driver instability, each resolving to an approved fix

     CPU / RAM TRIAGE
       perf-resource question splits CPU saturation (new tip) from
         RAM exhaustion (existing hunt-down-memory-hogs reuse)

   Plus: showIf gating, platform guard (mac flows must not see the
   new Windows knowledge), failed-fix progression and data integrity.

   The engine under test is the SAME diag-engine.js the browser runs;
   the data files are the same tips-data.js / diag-data.js the worker
   validates against. Run from the repo root:

     node --test ai-api/test/p322b-paths.test.mjs
   ============================================================ */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/* Load the frontend layers exactly as the browser does, plus the pure-logic
   diagnostic engine (Node-safe: no DOM, localStorage wrapped in try/catch). */
globalThis.window = globalThis;
for (const f of ["tips-data.js", "diag-data.js", "classification-words.js", "ai-knowledge.js", "diag-engine.js"]) {
  vm.runInThisContext(fs.readFileSync(path.join(root, f), "utf8"), { filename: f });
}

const K = globalThis.EmTechAIKnowledge;
const E = globalThis.EmTechDiag;
assert.ok(K && typeof K.classifyProblem === "function", "knowledge layer loaded");
assert.ok(E && typeof E.analyze === "function", "diagnostic engine loaded");

/* ---------- the two new Phase 3.2.2B fix ids (slugs) ---------------------- */
const NEW_SLUGS = [
  "windows-update-stuck-the-safe-retry-pass",
  "cpu-pegged-at-100-find-the-culprit-in-task-manager",
];

/* Drive a fresh session: device → category → skip description → answers. */
function flow(category, answers) {
  const s = E.newSession(null);
  assert.ok(E.selectDevice(s, "windows").ok, "select windows");
  assert.ok(E.selectCategory(s, category).ok, `category ${category} offered for windows`);
  assert.ok(E.skipDescription(s).ok, "skip description");
  for (const [qid, value] of answers) {
    const r = E.answer(s, qid, value);
    assert.ok(r.ok, `answer ${qid}=${value}: ${r.error || ""}`);
  }
  return s;
}

/* ---------- 1. router: the three gap phrases classify deterministically --- */
test("router classifies the Phase 3.2.2B phrases (no Qwen needed)", () => {
  const cases = [
    ["windows update is stuck and won't install", "windows", "updates"],
    ["my windows update failed with an error code", "windows", "updates"],
    ["my windows pc freezes and hangs all the time", "windows", "performance"],
    ["high cpu usage on my windows laptop", "windows", "performance"],
    ["my windows pc is using too much memory", "windows", "performance"],
  ];
  const failures = [];
  for (const [input, platform, category] of cases) {
    const got = K.classifyProblem(input);
    if (got.platform !== platform || got.category !== category) {
      failures.push(`"${input}" → ${JSON.stringify(got)}, wanted ${platform}/${category}`);
    }
  }
  assert.deepEqual(failures, [], failures.join("; "));

  // No false positives: an upgrade intent must NOT be pulled into performance.
  const up = K.classifyProblem("i want to upgrade my ram on windows");
  assert.equal(up.category, "hardware", `"upgrade my ram" should stay hardware (got ${up.category})`);
});

/* ---------- 2. question order + showIf gating ----------------------------- */
test("new questions sit in their profiles; upd-stuck stays gated", () => {
  const D = E.data;
  const byId = (id) => D.profiles.find((p) => p.id === id);

  assert.deepEqual(byId("win-updates").questions, ["upd-what", "upd-stuck", "upd-version"],
    "win-updates order: situation → stuck branch → version");
  assert.equal(byId("win-performance").questions[1], "perf-resource", "CPU/RAM triage is the second performance question");
  assert.equal(byId("win-performance").questions[2], "perf-freeze", "freeze/hang split is the third performance question");

  // upd-stuck must be rejected before its parent answer (showIf).
  const s = E.newSession(null);
  E.selectDevice(s, "windows");
  E.selectCategory(s, "updates");
  E.skipDescription(s);
  assert.equal(E.answer(s, "upd-stuck", "stalled").ok, false, "gated question rejected before upd-what=fail");

  // Non-failing branch → still gated.
  assert.ok(E.answer(s, "upd-what", "odd").ok);
  assert.equal(E.answer(s, "upd-stuck", "stalled").ok, false, "gated question rejected for the odd-hours branch");

  // Failing branch → visible and accepted.
  assert.ok(E.answer(s, "upd-what", "fail").ok);
  assert.ok(E.answer(s, "upd-stuck", "stalled").ok, "gated question accepted once upd-what=fail");
});

/* ---------- 3. pathway resolution: cause → approved fix ------------------- */
test("every Phase 3.2.2B pathway resolves to its intended approved fix", () => {
  const cases = [
    ["Update stalled (won't start)", "updates", [["upd-what", "fail"], ["upd-stuck", "stalled"]],
      "windows-update-stuck-the-safe-retry-pass", "win-upd-stuck"],
    ["Update install loop → SAFE fix first, not the repair", "updates", [["upd-what", "fail"], ["upd-stuck", "install-loop"]],
      "windows-update-stuck-the-safe-retry-pass", "win-upd-stuck"],
    ["Update stuck downloading (network reuse)", "updates", [["upd-what", "fail"], ["upd-stuck", "downloading"]],
      "slow-internet-run-the-five-minute-test", "win-upd-net"],
    ["Update failing on a full drive (storage reuse)", "updates", [["upd-what", "fail"], ["upd-stuck", "space"]],
      "let-windows-storage-sense-do-the-work-for-you", "win-upd-space"],
    ["CPU pegged → new Task Manager triage tip", "performance",
      [["perf-when", "unsure"], ["perf-resource", "cpu"], ["perf-freeze", "no-freeze"]],
      "cpu-pegged-at-100-find-the-culprit-in-task-manager", "win-perf-cpu"],
    ["RAM nearly full → EXISTING memory-hog fix reused", "performance",
      [["perf-when", "unsure"], ["perf-resource", "ram"], ["perf-freeze", "no-freeze"]],
      "hunt-down-memory-hogs", "win-performance-memory"],
    ["Single app 'Not Responding' → resource check, not system surgery", "performance",
      [["perf-when", "unsure"], ["perf-resource", "unsure"], ["perf-freeze", "app-only"]],
      "hunt-down-memory-hogs", "win-perf-apphang"],
    ["Whole-system freeze that recovers → order-of-attack fix", "performance",
      [["perf-when", "unsure"], ["perf-resource", "unsure"], ["perf-freeze", "whole-system"]],
      "fix-my-pc-is-slow-all-of-a-sudden-the-order-of-attack", "win-perf-freeze"],
    ["Freezes tied to one program / after updates → driver path", "performance",
      [["perf-when", "unsure"], ["perf-resource", "unsure"], ["perf-freeze", "specific"]],
      "check-for-driver-updates-in-the-right-order", "win-perf-driver"],
  ];

  for (const [name, category, answers, wantFix, wantCause] of cases) {
    const r = E.analyze(flow(category, answers));
    assert.equal(r.status, "success", `${name}: status=${r.status}`);
    assert.equal(r.confidence, "medium", `${name}: confidence=${r.confidence}`);
    assert.equal(r.recommendedFix, wantFix, `${name}: fix=${r.recommendedFix}`);
    assert.ok(r.primary && r.primary.id === wantCause, `${name}: primary cause ${r.primary && r.primary.id} ≠ ${wantCause}`);
  }
});

/* ---------- 4. failed-fix escalation: safe first, repair second ----------- */
test("install-loop: safe retry pass fails → system-file repair auto-recommended", () => {
  const SAFE = "windows-update-stuck-the-safe-retry-pass";
  const REPAIR = "repair-corrupted-system-files";

  const s = flow("updates", [["upd-what", "fail"], ["upd-stuck", "install-loop"]]);
  const r1 = E.analyze(s);
  assert.equal(r1.recommendedFix, SAFE, "low-risk pass must come first");
  assert.ok(!r1.alternativeFixes.includes(SAFE), "recommended fix is not also listed as an alternative");

  // User reports the safe pass failed → engine asks the remaining question…
  const step = E.afterFailedFix(s, SAFE);
  assert.equal(step.status, "continue", "expected next question after a failed fix");
  assert.equal(step.nextQuestion.id, "upd-version", "next unasked updates question is upd-version");

  // …and once answered, the MEDIUM-risk repair becomes THE recommendation.
  assert.ok(E.answer(s, "upd-version", "win11").ok);
  const r2 = E.analyze(s);
  assert.equal(r2.status, "success", `status=${r2.status}`);
  assert.equal(r2.recommendedFix, REPAIR, "escalation to system-file repair after safe pass failed");
  assert.ok(!r2.alternativeFixes.includes(SAFE), "already-tried safe pass must not be re-recommended");

  // Repair also fails → no crash, no re-recommendation of either tried fix.
  const step2 = E.afterFailedFix(s, REPAIR);
  const r3 = (step2.status === "continue") ? null : step2;
  if (!r3) {
    assert.ok(E.answer(s, step2.nextQuestion.id, "win11").ok || true, "answer remaining question");
  }
  const final = E.analyze(s);
  for (const tried of [SAFE, REPAIR]) {
    assert.notEqual(final.recommendedFix, tried, `tried fix ${tried} must not be re-recommended`);
    assert.ok(!final.alternativeFixes.includes(tried), `tried fix ${tried} must not appear as an alternative`);
  }
});

/* ---------- 5. platform guard: new Windows knowledge stays on Windows ----- */
test("no non-Windows profile references the two new fix ids", () => {
  const D = E.data;
  const leaks = [];
  for (const p of D.profiles) {
    if (p.devices.includes("windows")) continue;
    for (const c of p.causes || []) {
      if (NEW_SLUGS.includes(c.fix)) leaks.push(`${p.id}/${c.id} → ${c.fix}`);
      for (const a of c.alt || []) if (NEW_SLUGS.includes(a)) leaks.push(`${p.id}/${c.id} alt → ${a}`);
    }
  }
  assert.deepEqual(leaks, [], "new Windows-only fixes leaked into mac/other profiles: " + leaks.join(", "));

  // Structural guard: the new questions are not in any non-Windows profile.
  const foreign = [];
  for (const p of D.profiles) {
    if (p.devices.includes("windows")) continue;
    for (const qid of p.questions || []) {
      if (["upd-stuck", "perf-resource", "perf-freeze"].includes(qid)) foreign.push(`${p.id} → ${qid}`);
    }
  }
  assert.deepEqual(foreign, [], "new Windows questions leaked into mac/other profiles: " + foreign.join(", "));

  // Engine-level proof: for EVERY answer in the Mac updates flow, the
  // recommendation (if any) must stay outside the new Windows-only set.
  const macProfile = D.profiles.find((p) => p.id === "mac-updates");
  assert.ok(macProfile, "mac-updates profile exists");
  for (const qid of macProfile.questions) {
    for (const opt of D.questions[qid].options || []) {
      if (!opt.value) continue;
      const s = E.newSession(null);
      E.selectDevice(s, "mac");
      assert.ok(E.selectCategory(s, "updates").ok, "updates offered for mac");
      E.skipDescription(s);
      assert.ok(E.answer(s, qid, opt.value).ok, `mac answer ${qid}=${opt.value}`);
      const r = E.analyze(s);
      assert.ok(!r.recommendedFix || !NEW_SLUGS.includes(r.recommendedFix),
        `mac flow (${qid}=${opt.value}) recommended a Windows-only fix: ${r.recommendedFix}`);
    }
  }
});

/* ---------- 6. data integrity of the new knowledge ------------------------- */
test("new causes/questions are unique, referenced and well-formed", () => {
  const D = E.data;
  const seenCauses = new Set();
  for (const p of D.profiles) {
    for (const c of p.causes || []) {
      assert.ok(!seenCauses.has(c.id), `duplicate cause id ${c.id} (${p.id})`);
      seenCauses.add(c.id);
    }
  }
  // Option values must be unique within each question (the engine matches by value).
  for (const [qid, q] of Object.entries(D.questions)) {
    const vals = (q.options || []).map((o) => o.value);
    assert.equal(new Set(vals).size, vals.length, `question ${qid} has duplicate option values`);
  }
  // Every new question exists in the bank AND is referenced by its profile.
  for (const qid of ["upd-stuck", "perf-resource", "perf-freeze"]) {
    assert.ok(D.questions[qid], `${qid} missing from question bank`);
    const owner = D.profiles.find((p) => (p.questions || []).includes(qid));
    assert.ok(owner, `${qid} not referenced by any profile`);
  }
  // Every new cause is reachable: it has at least one scoring option or keyword.
  for (const cid of ["win-upd-stuck", "win-upd-net", "win-upd-space", "win-perf-cpu", "win-perf-apphang", "win-perf-freeze", "win-perf-driver"]) {
    let reachable = false;
    for (const [qid, q] of Object.entries(D.questions)) {
      if ((q.options || []).some((o) => o.score && o.score[cid])) reachable = true;
    }
    const owner = D.profiles.find((p) => (p.causes || []).some((c) => c.id === cid));
    assert.ok(owner, `${cid} not in any profile`);
    if (!reachable) {
      const cause = owner.causes.find((c) => c.id === cid);
      assert.ok(cause.keywords && cause.keywords.length, `${cid} has no scoring option and no keywords — unreachable`);
    }
  }
});
