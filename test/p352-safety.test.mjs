/* ============================================================
   EmTech Media — Phase 3.5.2 OTHER-device platform safety

   Implements the authorized Phase 3.5.2 test matrix:

     A  STRUCTURAL (P1-2)
        A1 no oth-* cause references a Windows- or Mac-specific fix slug;
           the ONLY allowed fix across all eight oth causes is
           slow-internet-run-the-five-minute-test
        A2 that one tip's actual content is platform-neutral (no OS UI,
           commands, settings or applications in title/description/steps)

     B  EXHAUSTIVE SWEEP (P1-2) — every answer combination × description
        variants for all four oth profiles, including the failed-fix
        escalation loop:
          * no presented fix (recommended OR alternative) is platform-specific
          * no tried fix is re-recommended; no infinite loop
          * terminal states are honest (insufficient/exhausted)
          * state.device never leaves "other"

     C  AUDIT-CONFIRMED LEAK PATHS (regression core)
        C1 perf-when=today + perf-scope=everything → NEVER a success verdict
           (pre-fix: oth-perf-memory → hunt-down-memory-hogs, Windows Task Manager)
        C2 perf-when=weeks + perf-scope=startup  → NEVER a success verdict
           (pre-fix: oth-perf-startup → disable-startup-bloat, Windows-only)

     D  NEUTRAL PATH PRESERVED — the router is NOT blanket-disabled:
        D1 oth-network still reaches a genuine recommendation with the
           platform-neutral five-minute test
        D2 oth-network insufficient states still list it as closest fix

     E  NO PLATFORM ESCALATION — "other" never becomes windows/mac through
        any diagnostic step (recommendation → failed-fix → terminal)

     F  WINDOWS/MAC REGRESSION GUARD
        F1 every non-oth cause declares a truthy fix, so the Phase 3.5.2
           engine guard structurally cannot fire for Windows or Mac profiles
        F2 Windows flows still receive their intended fixes (spot-check)

     G  MAC-SECURITY CONTRACT PIN (P2-3 — honest discrimination)
        G1 all four sec-what question-only paths stay honestly insufficient
        G2 genuine backup evidence → the Mac Time Machine fix (medium)
        G3 FileVault evidence → the Mac full-disk encryption fix (medium)
        G4 every mac-security fix is a Mac tip; no Windows fix referenced

     H  INERT / MISLEADING OPTIONS PIN (P2-4 — documented retention)
        H1 crash-what/gatekeeper inert in win+oth crashes, still scores mac
        H2 crash-what/bsod inert in mac crashes, still scores win-crash-bsod
        H3 crash-what/restarts inert in mac crashes; still scores oth + win
        H4 crash-what/frozen inert in oth crashes, still scores mac-crash-frozen
        H5 net-scope options all inert for oth-network (documented)

     I  CLASSIFIER REGRESSION PIN (§7 — exact current behavior, BOTH runtimes;
        the five tie-break precision gaps and five recall gaps are DEFERRED,
        not fixed in this phase; vocabulary stays v1.3.0)

   The engine under test is the SAME diag-engine.js the browser runs; the data
   files are the same tips-data.js / diag-data.js the worker validates against.
   Run from the repo root:

     node --test test/p352-safety.test.mjs
   ============================================================ */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* Load the frontend layers exactly as the browser does (Node-safe: no DOM). */
globalThis.window = globalThis;
for (const f of ["tips-data.js", "diag-data.js", "classification-words.js", "ai-knowledge.js", "diag-engine.js"]) {
  vm.runInThisContext(fs.readFileSync(path.join(root, f), "utf8"), { filename: f });
}

const K = globalThis.EmTechAIKnowledge;
const E = globalThis.EmTechDiag;
assert.ok(K && typeof K.classifyProblem === "function", "knowledge layer loaded");
assert.ok(E && typeof E.analyze === "function", "diagnostic engine loaded");

/* Worker-side classifier (same vocabulary file, CJS/ESM shim) — proves the
   pinned behavior holds on BOTH runtimes. */
const policy = await import(pathToFileURL(path.join(root, "ai-api", "src", "policy.js")).href);

const D = E.data;
const TIPS = vm.runInThisContext("TIPS");
const tipSlugFn = vm.runInThisContext("tipSlug");
function tipBySlug(slug) { return TIPS.find((t) => tipSlugFn(t.title) === slug); }

/* The ONLY platform-neutral fix in the 89-tip KB that fits an other-device
   cause (content-verified: speed test / wired-vs-wireless / router checks —
   no OS-specific UI, commands or applications). */
const NEUTRAL = "slow-internet-run-the-five-minute-test";
const ALLOWED_OTH_FIXES = new Set([NEUTRAL]);

/* ---------- Flow helpers (same shape as test/p34-paths.test.mjs) --------- */

function runOthCase(category, answers, description) {
  const s = E.newSession(null);
  assert.ok(E.selectDevice(s, "other").ok, "select other");
  assert.ok(E.selectCategory(s, category).ok, `category ${category} offered for other`);
  if (description) assert.ok(E.setDescription(s, description).ok, `description set: ${description}`);
  else assert.ok(E.skipDescription(s).ok, "skip description");
  for (const [qid, value] of Object.entries(answers)) {
    const r = E.answer(s, qid, value);
    assert.ok(r.ok, `answer ${qid}=${value}: ${r.error || ""}`);
  }
  return s;
}

/* The safety invariant for ANY result an "other" user can see: every fix the
   UI would render (recommended OR alternative) must be platform-neutral.
   Falsy entries are allowed — they come from causes that declare no fix and
   the UI renders nothing for them (verified in diag-ui.js altListHtml). */
function assertSafeResult(r, ctx) {
  if (r.status === "success") {
    assert.ok(
      r.recommendedFix && ALLOWED_OTH_FIXES.has(r.recommendedFix),
      `${ctx}: success fix "${r.recommendedFix}" is not platform-neutral`
    );
  } else if (r.recommendedFix) {
    throw new Error(`${ctx}: non-success status ${r.status} still carries a recommendedFix`);
  }
  for (const slug of r.alternativeFixes || []) {
    if (!slug) continue; // fix-less cause → UI renders nothing
    assert.ok(ALLOWED_OTH_FIXES.has(slug), `${ctx}: alternative "${slug}" is not platform-neutral`);
  }
}

/* Every answer combination for a profile (Cartesian product of options). */
function allAnswerCombos(profile) {
  let combos = [{}];
  for (const qid of profile.questions) {
    const values = D.questions[qid].options.map((o) => o.value);
    combos = combos.flatMap((c) => values.map((v) => ({ ...c, [qid]: v })));
  }
  return combos;
}

/* Drive one case through the full failed-fix escalation loop and assert the
   invariant at every step. Returns per-case stats for the report. */
function sweepProfile(profileId, descVariants) {
  const profile = D.profiles.find((p) => p.id === profileId);
  assert.ok(profile && profile.devices.includes("other"), `profile ${profileId} is an other-device profile`);
  const stats = { cases: 0, recommendations: 0, insufficientTerminals: 0, exhaustedTerminals: 0, maxSteps: 0 };

  for (const answers of allAnswerCombos(profile)) {
    for (const description of descVariants) {
      stats.cases++;
      const ctx = `${profileId} ${JSON.stringify(answers)} "${description}"`;
      const s = runOthCase(profile.category, answers, description);

      let r = E.analyze(s);
      assertSafeResult(r, ctx);
      if (r.status === "success") stats.recommendations++;

      const tried = new Set();
      let steps = 0;
      while (r.status === "success" && r.recommendedFix && steps < 12) {
        assert.ok(!tried.has(r.recommendedFix), `${ctx}: re-recommended a tried fix: ${r.recommendedFix}`);
        tried.add(r.recommendedFix);
        const next = E.afterFailedFix(s, r.recommendedFix);
        assert.notEqual(next.status, "continue", `${ctx}: unexpected pending question in oth sweep`);
        r = next;
        steps++;
        assertSafeResult(r, `${ctx} after failing ${r.recommendedFix}`);
      }
      stats.maxSteps = Math.max(stats.maxSteps, steps);

      if (r.status === "insufficient") stats.insufficientTerminals++;
      else if (r.status === "exhausted") stats.exhaustedTerminals++;
      else throw new Error(`${ctx}: unexpected terminal status ${r.status}`);

      assert.equal(s.device, "other", `${ctx}: platform escalated away from 'other'`);
    }
  }
  return stats;
}

/* ============================================================
   A — STRUCTURAL (P1-2)
   ============================================================ */

test("A1: no oth-* cause references a Windows- or Mac-specific fix (structural)", () => {
  const violations = [];
  for (const p of D.profiles) {
    if (!p.devices.includes("other")) continue;
    for (const c of p.causes || []) {
      for (const slug of [c.fix, ...(c.alt || [])].filter(Boolean)) {
        if (!ALLOWED_OTH_FIXES.has(slug)) violations.push(`${p.id}/${c.id} → ${slug}`);
      }
    }
  }
  assert.deepEqual(violations, [], "platform-specific fix leaked into an other-device profile: " + violations.join(", "));

  // And the positive side: exactly one oth cause keeps a fix — the neutral one.
  const withFix = [];
  for (const p of D.profiles) {
    if (!p.devices.includes("other")) continue;
    for (const c of p.causes || []) if (c.fix) withFix.push(`${c.id} → ${c.fix}`);
  }
  assert.deepEqual(withFix, ["oth-net-speed → " + NEUTRAL], `expected exactly one oth fix reference, got: ${withFix.join(", ")}`);
});

test("A2: the one allowed oth fix is content-neutral (no OS UI/commands/apps in its text)", () => {
  const t = tipBySlug(NEUTRAL);
  assert.ok(t, "neutral tip must exist in the KB");
  const text = [t.title, t.description || "", ...(t.steps || [])].join(" ").toLowerCase();
  const markers = [
    "task manager", "activity monitor", "apple menu", "cmd+shift+esc", "\u2318",
    "control panel", "regedit", "disk utility", "storage management", "system settings",
    "sfc /scannow", "dism ", "nvram", "filevault", "time machine",
  ];
  const hits = markers.filter((m) => text.includes(m));
  assert.deepEqual(hits, [], `neutral tip contains OS-specific references: ${hits.join(", ")}`);
});

/* ============================================================
   B — EXHAUSTIVE SWEEP (P1-2), all four other-device profiles
   ============================================================ */

test("B1: oth-performance sweep — 20 combos × 2 descriptions, zero platform-specific fixes", () => {
  const stats = sweepProfile("oth-performance", ["", "my computer is slow, laggy and freezing at startup"]);
  assert.equal(stats.cases, 40);
  console.log(`[p352] oth-performance: ${JSON.stringify(stats)}`);
});

test("B2: oth-network sweep — 9 combos × 2 descriptions, zero platform-specific fixes", () => {
  const stats = sweepProfile("oth-network", ["", "my wifi keeps dropping and the internet is slow, buffering everywhere"]);
  assert.equal(stats.cases, 18);
  console.log(`[p352] oth-network: ${JSON.stringify(stats)}`);
});

test("B3: oth-storage sweep — 4 combos × 2 descriptions, zero platform-specific fixes", () => {
  const stats = sweepProfile("oth-storage", ["", "my drive is full, no space left, storage warning"]);
  assert.equal(stats.cases, 8);
  console.log(`[p352] oth-storage: ${JSON.stringify(stats)}`);
});

test("B4: oth-crashes sweep — 5 combos × 2 descriptions, zero platform-specific fixes", () => {
  const stats = sweepProfile("oth-crashes", ["", "it crashes randomly, glitchy and weird, won't start sometimes"]);
  assert.equal(stats.cases, 10);
  console.log(`[p352] oth-crashes: ${JSON.stringify(stats)}`);
});

/* ============================================================
   C — AUDIT-CONFIRMED LEAK PATHS (the two reachable defects)
   ============================================================ */

test("C1: audit leak path 1 — today+everything can never produce a success verdict", () => {
  // Pre-fix this combination scored oth-perf-memory to confidence and served
  // hunt-down-memory-hogs (Windows Task Manager). The keyword-rich description
  // pushes the score well past mediumMin, so only the engine guard stops it.
  const s = runOthCase("performance", { "perf-when": "today", "perf-scope": "everything" }, "slow laggy freezing");
  const r = E.analyze(s);
  assert.equal(r.status, "insufficient", `status=${r.status} (must be honest insufficient, not a verdict)`);
  assert.equal(r.recommendedFix, null, "no fix may be recommended to an other-device user here");
});

test("C2: audit leak path 2 — weeks+startup can never produce a success verdict", () => {
  // Pre-fix this combination served disable-startup-bloat (Windows-only).
  const s = runOthCase("performance", { "perf-when": "weeks", "perf-scope": "startup" }, "slow at startup boot login");
  const r = E.analyze(s);
  assert.equal(r.status, "insufficient", `status=${r.status} (must be honest insufficient, not a verdict)`);
  assert.equal(r.recommendedFix, null, "no fix may be recommended to an other-device user here");
});

/* ============================================================
   D — NEUTRAL PATH PRESERVED (router is NOT blanket-disabled)
   ============================================================ */

test("D1: oth-network still reaches a genuine recommendation with the neutral five-minute test", () => {
  const s = runOthCase("network", { "net-when": "always", "net-scope": "unsure" }, "slow internet buffering");
  const r = E.analyze(s);
  assert.equal(r.status, "success", `status=${r.status} (the neutral path must still work)`);
  assert.ok(["medium", "high"].includes(r.confidence), `confidence=${r.confidence}`);
  assert.equal(r.recommendedFix, NEUTRAL, `fix=${r.recommendedFix}`);
});

test("D2: oth-network insufficient states still list the neutral fix as closest", () => {
  const s = runOthCase("network", { "net-when": "sleep", "net-scope": "one" }, "");
  const r = E.analyze(s);
  assert.equal(r.status, "insufficient", `status=${r.status}`);
  assert.ok((r.alternativeFixes || []).includes(NEUTRAL), `closest fixes should include the neutral test (got: ${(r.alternativeFixes || []).join(", ")})`);
});

/* ============================================================
   E — NO PLATFORM ESCALATION
   ============================================================ */

test("E: 'other' never becomes windows/mac through recommendation → failed-fix → terminal", () => {
  const s = runOthCase("network", { "net-when": "always", "net-scope": "unsure" }, "slow internet buffering");
  let r = E.analyze(s);
  assert.equal(r.status, "success");
  assert.equal(s.device, "other");
  const next = E.afterFailedFix(s, r.recommendedFix);
  assert.notEqual(next.status, "continue");
  assert.equal(s.device, "other", "platform must not change as a side effect of the failed-fix loop");
  assertSafeResult(next, "E terminal state");
});

/* ============================================================
   F — WINDOWS/MAC REGRESSION GUARD
   ============================================================ */

test("F1: every non-oth cause declares a truthy fix — the Phase 3.5.2 guard cannot fire for Windows/Mac", () => {
  const missing = [];
  for (const p of D.profiles) {
    if (p.devices.includes("other")) continue;
    for (const c of p.causes || []) if (!c.fix) missing.push(`${p.id}/${c.id}`);
  }
  assert.deepEqual(missing, [], "a Windows/Mac cause without a fix would change its behavior: " + missing.join(", "));
});

test("F2: Windows flows still receive their intended fixes (security/popups spot-check)", () => {
  const s = E.newSession(null);
  assert.ok(E.selectDevice(s, "windows").ok);
  assert.ok(E.selectCategory(s, "security").ok);
  assert.ok(E.skipDescription(s).ok);
  assert.ok(E.answer(s, "sec-what", "popups").ok);
  const r = E.analyze(s);
  assert.equal(r.status, "success", `status=${r.status}`);
  assert.equal(r.recommendedFix, "kill-shady-pc-optimizer-software", `fix=${r.recommendedFix}`);
  const t = tipBySlug(r.recommendedFix);
  assert.ok(t && t.cat !== "mac", "a Windows user must receive a non-Mac fix");
});

/* ============================================================
   G — MAC-SECURITY CONTRACT PIN (P2-3)
   ============================================================ */

test("G1: mac-security question-only paths stay honestly insufficient (all four options)", () => {
  for (const value of ["popups", "email", "general", "ransom"]) {
    const s = E.newSession(null);
    assert.ok(E.selectDevice(s, "mac").ok);
    assert.ok(E.selectCategory(s, "security").ok);
    assert.ok(E.skipDescription(s).ok);
    assert.ok(E.answer(s, "sec-what", value).ok);
    const r = E.analyze(s);
    assert.equal(r.status, "insufficient", `sec-what=${value}: status=${r.status} (question-only signal must not manufacture confidence)`);
    assert.equal(r.recommendedFix, null, `sec-what=${value}: no fix without enough evidence`);
  }
});

test("G2: genuine backup evidence → the Mac Time Machine fix at medium confidence", () => {
  const s = E.newSession(null);
  assert.ok(E.selectDevice(s, "mac").ok);
  assert.ok(E.selectCategory(s, "security").ok);
  assert.ok(E.setDescription(s, "backup time machine").ok);
  const r = E.analyze(s);
  assert.equal(r.status, "success", `status=${r.status}`);
  assert.equal(r.confidence, "medium", `confidence=${r.confidence}`);
  assert.equal(r.recommendedFix, "set-up-time-machine-properly", `fix=${r.recommendedFix}`);
  assert.ok(r.primary && r.primary.id === "mac-sec-backup", `primary=${r.primary && r.primary.id}`);
});

test("G3: FileVault evidence → the Mac full-disk encryption fix at medium confidence", () => {
  const s = E.newSession(null);
  assert.ok(E.selectDevice(s, "mac").ok);
  assert.ok(E.selectCategory(s, "security").ok);
  assert.ok(E.setDescription(s, "filevault encryption stolen").ok);
  const r = E.analyze(s);
  assert.equal(r.status, "success", `status=${r.status}`);
  assert.equal(r.confidence, "medium", `confidence=${r.confidence}`);
  assert.equal(r.recommendedFix, "turn-on-filevault-full-disk-encryption", `fix=${r.recommendedFix}`);
  assert.ok(r.primary && r.primary.id === "mac-sec-encrypt", `primary=${r.primary && r.primary.id}`);
});

test("G4: every mac-security fix is a Mac tip; no Windows fix referenced in the profile (structural)", () => {
  const p = D.profiles.find((x) => x.id === "mac-security");
  assert.ok(p, "mac-security profile exists");
  for (const c of p.causes || []) {
    for (const slug of [c.fix, ...(c.alt || [])].filter(Boolean)) {
      const t = tipBySlug(slug);
      assert.ok(t && t.cat === "mac", `${c.id} → ${slug} must resolve to a Mac fix`);
    }
  }
});

/* ============================================================
   H — INERT / MISLEADING OPTIONS PIN (P2-4, documented retention)
   ============================================================ */

function optScoreForProfile(profileId, qid, value) {
  const p = D.profiles.find((x) => x.id === profileId);
  assert.ok(p, `profile ${profileId} exists`);
  const opt = D.questions[qid].options.find((o) => o.value === value);
  assert.ok(opt, `${qid}/${value} option exists`);
  return p.causes.reduce((sum, c) => sum + ((opt.score || {})[c.id] || 0), 0);
}

test("H1: crash-what/gatekeeper is inert in win+oth crashes but still scores mac-crash-gatekeeper", () => {
  assert.equal(optScoreForProfile("win-crashes", "crash-what", "gatekeeper"), 0, "inert for Windows (pinned)");
  assert.equal(optScoreForProfile("oth-crashes", "crash-what", "gatekeeper"), 0, "inert for other (pinned)");
  assert.ok(optScoreForProfile("mac-crashes", "crash-what", "gatekeeper") > 0, "option must remain useful where it belongs (Mac)");
});

test("H2: crash-what/bsod is inert in mac crashes but still scores win-crash-bsod", () => {
  assert.equal(optScoreForProfile("mac-crashes", "crash-what", "bsod"), 0, "inert for Mac (pinned)");
  assert.ok(optScoreForProfile("win-crashes", "crash-what", "bsod") > 0, "option must remain useful where it belongs (Windows)");
});

test("H3: crash-what/restarts is inert in mac crashes; still scores oth-crash-corrupt and Windows causes", () => {
  assert.equal(optScoreForProfile("mac-crashes", "crash-what", "restarts"), 0, "inert for Mac (pinned)");
  assert.ok(optScoreForProfile("oth-crashes", "crash-what", "restarts") > 0, "option must remain useful where it belongs (other)");
  assert.ok(optScoreForProfile("win-crashes", "crash-what", "restarts") > 0, "option must remain useful where it belongs (Windows)");
});

test("H4: crash-what/frozen is inert in oth crashes but still scores mac-crash-frozen", () => {
  assert.equal(optScoreForProfile("oth-crashes", "crash-what", "frozen"), 0, "inert for other (pinned)");
  assert.ok(optScoreForProfile("mac-crashes", "crash-what", "frozen") > 0, "option must remain useful where it belongs (Mac)");
});

test("H5: net-scope options are all inert for oth-network (documented retention)", () => {
  for (const value of ["one", "many", "unsure"]) {
    assert.equal(optScoreForProfile("oth-network", "net-scope", value), 0, `net-scope/${value} inert for other (pinned)`);
  }
});

/* ============================================================
   I — CLASSIFIER REGRESSION PIN (§7; exact current behavior)
   ============================================================ */

test("I: the ten audited phrases keep their EXACT current classification on BOTH runtimes", () => {
  // [phrase, browserPlatform, browserCategory] — the worker must agree on category.
  // The five tie-break precision gaps and five recall gaps are DEFERRED to a
  // later phase (clearWinner tie semantics + vocabulary); this test pins the
  // current behavior so any future change is deliberate and reviewed.
  const cases = [
    ["my windows internet is slow", "windows", "performance"],
    ["wifi is slow on my imac", "mac", "performance"],
    ["slow wifi on my laptop", null, "performance"],
    ["my touchpad is unresponsive on my macbook", "mac", "performance"],
    ["my wifi printer is offline on windows", "windows", "network"],
    ["my mac is full, need to free up space", "mac", null],
    ["time machine backup failing on my mac", "mac", null],
    ["my mac keeps randomly restarting", "mac", null],
    ["screen is black after sleep on my mac", "mac", null],
    ["teams can't see my camera on my mac", "mac", null],
  ];
  const failures = [];
  for (const [input, wantPlatform, wantCat] of cases) {
    const b = K.classifyProblem(input);
    if (b.platform !== wantPlatform || b.category !== wantCat) {
      failures.push(`browser: "${input}" → ${b.platform}/${b.category}, wanted ${wantPlatform}/${wantCat}`);
    }
    const w = policy.clearWinner(policy.classifyText(input).scores);
    if (w !== wantCat) failures.push(`worker:  "${input}" → ${w}, wanted ${wantCat}`);
  }
  assert.deepEqual(failures, [], failures.join("; "));
});

test("I2: classifier vocabulary is unchanged in Phase 3.5.2 (still v1.3.0)", () => {
  const words = globalThis.EmTechClassificationWords;
  assert.equal(words.version, "1.3.0", `classification-words.js version=${words.version} (Phase 3.5.2 adds no vocabulary)`);
});
