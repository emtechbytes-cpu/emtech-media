/* ============================================================
   EmTech AI — Phase 3.2.2A Windows P0 diagnostic pathway tests

   Exercises the NEW knowledge added in this phase end-to-end at the
   deterministic layer (no network, no model calls):

     router classification of the new phrases
       → question order + showIf gating
         → cause resolution per pathway
           → fix recommendation (approved slug only)
             → failed-fix progression + exhaustion

   The engine under test is the SAME diag-engine.js the browser runs;
   the data files are the same tips-data.js / diag-data.js the worker
   validates against. Run from the repo root:

     node --test ai-api/test/p322a-paths.test.mjs
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

/* ---------- the six new Phase 3.2.2A fix ids (slugs) ---------------------- */
const NEW_SLUGS = [
  "pc-won-t-turn-on-run-the-five-minute-power-check",
  "black-screen-check-the-display-signal-path-first",
  "wi-fi-off-or-missing-the-three-switches-that-disable-it",
  "connected-but-no-internet-the-safe-dns-and-stack-reset",
  "bluetooth-won-t-connect-the-pairing-reset-that-works",
  "usb-device-not-recognised-the-device-manager-pass",
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

/* ---------- 1. router: new P0 phrases classify to the right branch -------- */
test("router classifies the new Windows P0 phrases (no Qwen needed)", () => {
  const cases = [
    ["my windows pc won't turn on at all", "windows", "crashes"],
    ["windows laptop screen says no signal", "windows", "crashes"],
    ["no power to my desktop pc in windows", "windows", "crashes"],
    ["bluetooth won't connect on my windows laptop", "windows", "hardware"],
    ["external monitor not detected on windows", "windows", "hardware"],
    ["second screen not showing up windows", "windows", "hardware"],
    ["my mouse stopped working on windows", "windows", "hardware"],
    ["wi-fi is off and missing on my windows pc", "windows", "network"],
  ];
  const failures = [];
  for (const [input, platform, category] of cases) {
    const got = K.classifyProblem(input);
    if (got.platform !== platform || got.category !== category) {
      failures.push(`"${input}" → ${JSON.stringify(got)}, wanted ${platform}/${category}`);
    }
  }
  assert.deepEqual(failures, [], failures.join("; "));
});

/* ---------- 2. question order: decisive questions come first -------------- */
test("new decisive questions are first in their profiles; mac flows unchanged", () => {
  const D = E.data;
  const byId = (id) => D.profiles.find((p) => p.id === id);

  assert.equal(byId("win-crashes").questions[0], "crash-power", "power check must be the first crash question");
  assert.ok(byId("win-crashes").questions.includes("crash-screen"), "signal-path question present in win-crashes");
  assert.equal(byId("win-network").questions[0], "net-state", "Wi-Fi state must be the first network question");

  // Regression: non-Windows profiles keep their original opening questions.
  assert.equal(byId("mac-crashes").questions[0], "crash-what", "mac-crashes flow unchanged");
  assert.deepEqual(byId("oth-crashes").questions, ["crash-what"], "other-crashes flow unchanged");

  // New options landed on the existing questions (not new duplicate questions).
  const hwWhat = D.questions["hw-what"].options.map((o) => o.value);
  for (const v of ["bluetooth", "monitor", "usb"]) assert.ok(hwWhat.includes(v), `hw-what gained option ${v}`);
  assert.ok(D.questions["store-what"].options.some((o) => o.value === "failing"), "store-what gained failing option");
});

/* ---------- 3. pathway resolution: cause → approved fix ------------------- */
test("every new P0 pathway resolves to its intended approved fix", () => {
  const cases = [
    ["PC won't turn on (power path)", "crashes", [["crash-power", "dead"]],
      "pc-won-t-turn-on-run-the-five-minute-power-check", "win-crash-power"],
    ["Black screen → no signal", "crashes", [["crash-power", "black"], ["crash-screen", "nosignal"]],
      "black-screen-check-the-display-signal-path-first", "win-crash-signal"],
    ["Black screen → cursor visible (GPU/driver)", "crashes", [["crash-power", "black"], ["crash-screen", "cursor"]],
      "check-for-driver-updates-in-the-right-order", "win-crash-gpu"],
    ["Regression: stuck at boot keeps its original fix", "crashes", [["crash-power", "partway"]],
      "fix-a-pc-that-won-t-start-up", "win-crash-boot"],
    ["Wi-Fi off or missing", "network", [["net-state", "off"]],
      "wi-fi-off-or-missing-the-three-switches-that-disable-it", "win-net-off"],
    ["Connected but no internet (DNS/stack)", "network", [["net-state", "connected-nointernet"]],
      "connected-but-no-internet-the-safe-dns-and-stack-reset", "win-net-dns"],
    ["Bluetooth won't connect", "hardware", [["hw-what", "bluetooth"]],
      "bluetooth-won-t-connect-the-pairing-reset-that-works", "win-hw-bt"],
    ["External monitor not detected (shares signal-path fix)", "hardware", [["hw-what", "monitor"]],
      "black-screen-check-the-display-signal-path-first", "win-hw-monitor"],
    ["USB device not recognised", "hardware", [["hw-what", "usb"]],
      "usb-device-not-recognised-the-device-manager-pass", "win-hw-usb"],
    ["Failing drive (storage)", "storage", [["store-what", "failing"]],
      "run-a-disk-health-check-before-it-s-too-late", "win-store-fail"],
  ];

  for (const [name, category, answers, wantFix, wantCause] of cases) {
    const r = E.analyze(flow(category, answers));
    assert.equal(r.status, "success", `${name}: status=${r.status}`);
    assert.equal(r.confidence, "medium", `${name}: confidence=${r.confidence}`);
    assert.equal(r.recommendedFix, wantFix, `${name}: fix=${r.recommendedFix}`);
    assert.ok(r.primary && r.primary.id === wantCause, `${name}: primary cause ${r.primary && r.primary.id} ≠ ${wantCause}`);
  }
});

/* ---------- 4. showIf gating: conditional questions stay gated ------------ */
test("crash-screen is only answerable after crash-power=black", () => {
  const s = E.newSession(null);
  E.selectDevice(s, "windows");
  E.selectCategory(s, "crashes");
  E.skipDescription(s);

  // Not visible yet → the engine must refuse it.
  assert.equal(E.answer(s, "crash-screen", "nosignal").ok, false, "gated question rejected before its parent answer");

  // Parent answered with a non-black branch → still gated (and any stale
  // answer would be pruned).
  assert.ok(E.answer(s, "crash-power", "dead").ok);
  assert.equal(E.answer(s, "crash-screen", "nosignal").ok, false, "gated question rejected for the dead-PC branch");

  // Re-answer parent with black → now visible and accepted.
  assert.ok(E.answer(s, "crash-power", "black").ok);
  assert.ok(E.answer(s, "crash-screen", "nosignal").ok, "gated question accepted once crash-power=black");
});

/* ---------- 5. platform guard: new Windows knowledge stays on Windows ----- */
test("no non-Windows profile references the six new fix ids", () => {
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

  // Engine-level proof: for EVERY possible answer in the Mac crash flow,
  // the recommendation (if any) must stay outside the new Windows-only set.
  const macProfile = D.profiles.find((p) => p.id === "mac-crashes");
  for (const qid of macProfile.questions) {
    for (const opt of D.questions[qid].options || []) {
      if (!opt.value) continue;
      const s = E.newSession(null);
      E.selectDevice(s, "mac");
      E.selectCategory(s, "crashes");
      E.skipDescription(s);
      assert.ok(E.answer(s, qid, opt.value).ok, `mac answer ${qid}=${opt.value}`);
      const r = E.analyze(s);
      assert.ok(!r.recommendedFix || !NEW_SLUGS.includes(r.recommendedFix),
        `mac flow (${qid}=${opt.value}) recommended a Windows-only fix: ${r.recommendedFix}`);
    }
  }
});

/* ---------- 6. failed-fix progression: no dead ends ------------------------ */
test("failed signal-path fix advances to the next question, then a new fix", () => {
  const s = flow("crashes", [["crash-power", "black"], ["crash-screen", "nosignal"]]);
  const r1 = E.analyze(s);
  assert.equal(r1.recommendedFix, "black-screen-check-the-display-signal-path-first");

  // User reports it failed → engine must keep the session alive.
  const step = E.afterFailedFix(s, r1.recommendedFix);
  assert.equal(step.status, "continue", "expected next question after a failed fix");
  assert.equal(step.nextQuestion.id, "crash-what", "next unasked crash question is crash-what");

  // Answering it re-ranks: the boot path (untried) now wins.
  assert.ok(E.answer(s, "crash-what", "boot").ok);
  const r2 = E.analyze(s);
  assert.equal(r2.status, "success");
  assert.equal(r2.recommendedFix, "fix-a-pc-that-won-t-start-up", "untried boot fix recommended after failure");
  assert.ok(!r2.alternativeFixes.includes("black-screen-check-the-display-signal-path-first"),
    "already-tried fix must not be re-recommended as an alternative");
});

test("exhausting every win-crashes fix reports exhausted, not a crash", () => {
  const s = flow("crashes", [["crash-power", "black"], ["crash-screen", "nosignal"]]);
  for (const slug of [
    "pc-won-t-turn-on-run-the-five-minute-power-check",
    "black-screen-check-the-display-signal-path-first",
    "check-for-driver-updates-in-the-right-order",
    "fix-a-blue-screen-bsod-without-panicking",
    "fix-a-pc-that-won-t-start-up",
    "repair-corrupted-system-files",
  ]) E.afterFailedFix(s, slug);
  const r = E.analyze(s);
  assert.equal(r.status, "exhausted", `status=${r.status}`);
});

/* ---------- 7. data integrity of the new knowledge ------------------------- */
test("new causes are globally unique and question options stay well-formed", () => {
  const D = E.data;
  const seen = new Set();
  for (const p of D.profiles) {
    for (const c of p.causes || []) {
      assert.ok(!seen.has(c.id), `duplicate cause id ${c.id} (${p.id})`);
      seen.add(c.id);
    }
  }
  // Option values must be unique within each question (the engine matches by value).
  for (const [qid, q] of Object.entries(D.questions)) {
    const vals = (q.options || []).map((o) => o.value);
    assert.equal(new Set(vals).size, vals.length, `question ${qid} has duplicate option values`);
  }
  // Every new question exists in the bank AND is referenced by its profile.
  for (const qid of ["crash-power", "crash-screen", "net-state"]) {
    assert.ok(D.questions[qid], `${qid} missing from question bank`);
    const owner = D.profiles.find((p) => (p.questions || []).includes(qid));
    assert.ok(owner, `${qid} not referenced by any profile`);
  }
});
