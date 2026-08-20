/* ============================================================
   EmTech AI — Phase 3.3 macOS diagnostic quality + classifier precision

   Exercises the four Phase 3.3 areas end-to-end at the deterministic
   layer (no network, no model calls):

     BLUETOOTH/HEADPHONES CLASSIFIER INTENT (Part 1)
       "no sound" phrasings stay AUDIO; pairing/connect phrasings go to
       HARDWARE — verified on BOTH runtimes (browser classifyProblem and
       the worker's classifyText/clearWinner), plus a Wi-Fi false-positive
       guard ("wifi won't connect" must NOT be pulled into hardware).

     TRACKPAD / MOUSE (Part 2)
       hw-mac-what=input → new safe restart pass FIRST (medium confidence)
         → failed fix → NVRAM reset (existing tip reused) escalates in
           → both fail → honest exhaustion scoped to the input group
             (Phase 3.4 §8/§9: no cross-category fall-through)

     FREEZE / HANG (Part 3)
       mac-freeze question splits one-app hang / whole-Mac lockup / repeated
       freezes — each branch resolves to an EXISTING approved Mac fix
       (force-quit / speed-up pass / login cleanup); the "no-freeze" escape
       hatch keeps pure-slowness users on the original slow path.

     MICROPHONE (Part 4)
       The structured mac-audio flow KEEPS its honest insufficient branch for
       mic and one-app answers (single-pathway profile — Phase 3.2.3 design);
       the two new first-principles mic tips are verified resolvable and
       reachable through the free-text search path instead.

   Plus: failed-fix progression, exhaustion termination, platform guard in
   both directions, worker-side approved question/fix availability, and data
   integrity (unique cause ids, unique option values, 89 unique slugs).

   The engine under test is the SAME diag-engine.js the browser runs; the
   data files are the same tips-data.js / diag-data.js the worker validates
   against. Run from the repo root:

     node --test ai-api/test/p33-paths.test.mjs
   ============================================================ */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/* Load the frontend layers exactly as the browser does, plus the pure-logic
   diagnostic engine (Node-safe: no DOM). */
globalThis.window = globalThis;
for (const f of ["tips-data.js", "diag-data.js", "classification-words.js", "ai-knowledge.js", "diag-engine.js"]) {
  vm.runInThisContext(fs.readFileSync(path.join(root, f), "utf8"), { filename: f });
}

const K = globalThis.EmTechAIKnowledge;
const E = globalThis.EmTechDiag;
assert.ok(K && typeof K.classifyProblem === "function", "knowledge layer loaded");
assert.ok(E && typeof E.analyze === "function", "diagnostic engine loaded");

/* Worker-side knowledge + router (same files, CJS/ESM shim) — proves the new
   ids and vocabulary are in the sets the worker validates/routes against. */
const knowledge = await import(pathToFileURL(path.join(root, "ai-api", "src", "knowledge.js")).href);
const policy = await import(pathToFileURL(path.join(root, "ai-api", "src", "policy.js")).href);

/* ---------- Phase 3.3 fix ids (slugs) ------------------------------------ */
const NEW_SLUGS = [
  "trackpad-or-mouse-not-working-on-your-mac-the-safe-restart-pass",
  "no-microphone-on-your-mac-check-the-input-device-first",
  "microphone-permission-on-your-mac-let-the-app-use-it",
];
const REUSED = {
  nvram: "reset-nvram-when-things-misbehave",
  forceQuit: "force-quit-a-frozen-app",
  speedUp: "speed-up-a-sluggish-macbook",
  stopLogin: "stop-apps-from-launching-at-login",
  freeSpace: "free-up-disk-space-with-storage-management",
};

/* Drive a fresh Mac session: device → category → skip description → answers. */
function flow(category, answers) {
  const s = E.newSession(null);
  assert.ok(E.selectDevice(s, "mac").ok, "select mac");
  assert.ok(E.selectCategory(s, category).ok, `category ${category} offered for mac`);
  assert.ok(E.skipDescription(s).ok, "skip description");
  for (const [qid, value] of answers) {
    const r = E.answer(s, qid, value);
    assert.ok(r.ok, `answer ${qid}=${value}: ${r.error || ""}`);
  }
  return s;
}

/* ---------- 1. classifier intent: audio vs pairing (Part 1) -------------- */
test("Bluetooth/headphones intent: sound phrasings → audio, pairing phrasings → hardware", () => {
  const cases = [
    // A — plain silence is audio
    ["my mac has no sound", "audio"],
    // B — bluetooth + headphones + NO SOUND stays audio (sound dominates)
    ["my bluetooth headphones have no sound", "audio"],
    // C — pairing/connect intent beats the headphone word → hardware
    ["my bluetooth headphones won't connect", "hardware"],
    // D — same for "won't pair"
    ["my bluetooth headphones won't pair", "hardware"],
    // E — plain Bluetooth pairing problem (already worked pre-Phase 3.3)
    ["bluetooth won't pair with my mac", "hardware"],
    // F — output-device detection is audio, not hardware
    ["my headphones aren't detected as an output device", "audio"],
  ];

  const failures = [];
  for (const [input, wantCat] of cases) {
    // Browser classifier.
    const got = K.classifyProblem(input);
    if (got.category !== wantCat) failures.push(`browser: "${input}" → ${got.category}, wanted ${wantCat}`);
    // Worker router — must agree on the same canonical vocabulary.
    const w = policy.clearWinner(policy.classifyText(input).scores);
    if (w !== wantCat) failures.push(`worker:  "${input}" → ${w}, wanted ${wantCat}`);
  }
  assert.deepEqual(failures, [], failures.join("; "));

  // False-positive guard: a Wi-Fi phrase with "won't connect" must stay
  // NETWORK — the new hardware phrases are device-specific on purpose.
  const wifi = K.classifyProblem("my wifi won't connect on my mac");
  assert.equal(wifi.category, "network", `"wifi won't connect" must stay network (got ${wifi.category})`);
  assert.equal(policy.clearWinner(policy.classifyText("my wifi won't connect on my mac").scores), "network",
    "worker: wifi phrase must not be pulled into hardware");

  // And the vocabulary version stamp moved, proving both runtimes read v1.3.0.
  const words = globalThis.EmTechClassificationWords;
  assert.equal(words.version, "1.3.0", "classification-words.js should be at v1.3.0");
});

/* ---------- 2. trackpad/mouse pathway (Part 2) --------------------------- */
test("trackpad/mouse: safe restart pass first → NVRAM escalates in after failure", () => {
  const s = flow("hardware", [["hw-mac-what", "input"]]);

  const r1 = E.analyze(s);
  assert.equal(r1.status, "success", `status=${r1.status}`);
  assert.equal(r1.confidence, "medium", `confidence=${r1.confidence}`);
  assert.equal(r1.recommendedFix, NEW_SLUGS[0], `fix=${r1.recommendedFix}`);
  assert.ok(r1.primary && r1.primary.id === "mac-hw-input", `primary cause ${r1.primary && r1.primary.id} ≠ mac-hw-input`);

  // Restart pass fails → the existing NVRAM reset escalates in (reused, not duplicated).
  const r2 = E.afterFailedFix(s, NEW_SLUGS[0]);
  assert.equal(r2.status, "success", `status=${r2.status}`);
  assert.equal(r2.recommendedFix, REUSED.nvram, `fix=${r2.recommendedFix} (wanted the reused NVRAM reset)`);
  assert.ok(!r2.alternativeFixes.includes(NEW_SLUGS[0]), "already-tried restart pass must not be re-listed");

  /* Phase 3.4 (§8/§9) — the input branch is now a scoped group (restart pass
     + NVRAM reset). Once both are tried the flow reaches TRUE exhaustion:
     no new recommendation, and "all fixes in this area" stays inside the
     input group (the shipped UI lists those with "Tried" markers).
     The old Phase 3.3 fall-through into battery/drives/display tips was a
     cross-category leak that scoping removes on purpose — so this block now
     PINS honest exhaustion instead of allowing either outcome. */
  const r3 = E.afterFailedFix(s, REUSED.nvram);
  assert.equal(r3.status, "exhausted", `status=${r3.status} (honest exhaustion after both input fixes)`);
  assert.equal(r3.recommendedFix, null, "exhaustion must not recommend a fix");
  const alts = [...(r3.alternativeFixes || [])].sort();
  assert.deepEqual(alts, [NEW_SLUGS[0], REUSED.nvram].sort(),
    `exhaustion lists exactly the two input-group fixes (got: ${alts.join(", ")})`);
  const foreign = [
    "keep-your-mac-battery-healthy",
    "run-first-aid-on-external-drives",
    "external-monitor-not-detected-on-your-mac",
    "bluetooth-won-t-pair-on-your-mac-reset-it-properly",
  ];
  for (const f of foreign) {
    assert.ok(!alts.includes(f), `cross-category fix ${f} must not leak into the input branch`);
  }
});

/* ---------- 3. freeze/hang pathways (Part 3) ------------------------------ */
test("freeze/hang: each branch resolves to its intended EXISTING approved fix", () => {
  const cases = [
    ["One app frozen → force-quit (existing tip reused)",
      [["perf-when", "today"], ["mac-freeze", "app-only"], ["perf-scope", "apps"], ["mac-space", "unsure"]],
      REUSED.forceQuit, "mac-perf-apphang"],
    ["Whole-Mac lockup → speed-up pass (existing tip reused)",
      [["perf-when", "today"], ["mac-freeze", "whole-system"], ["perf-scope", "everything"], ["mac-space", "unsure"]],
      REUSED.speedUp, "mac-perf-freeze"],
    ["Repeated freezes → login-item cleanup (existing tip reused)",
      [["perf-when", "today"], ["mac-freeze", "specific"], ["perf-scope", "everything"], ["mac-space", "unsure"]],
      REUSED.stopLogin, "mac-perf-repeat"],
  ];

  for (const [name, answers, wantFix, wantCause] of cases) {
    const r = E.analyze(flow("performance", answers));
    assert.equal(r.status, "success", `${name}: status=${r.status}`);
    assert.ok(["medium", "high"].includes(r.confidence), `${name}: confidence=${r.confidence}`);
    assert.equal(r.recommendedFix, wantFix, `${name}: fix=${r.recommendedFix}`);
    assert.ok(r.primary && r.primary.id === wantCause, `${name}: primary cause ${r.primary && r.primary.id} ≠ ${wantCause}`);
  }

  // "No-freeze" escape hatch: a pure-slowness user stays on the original slow
  // path (disk pressure wins here) — Phase 3.2.x behaviour is untouched.
  const r = E.analyze(flow("performance", [
    ["perf-when", "today"], ["mac-freeze", "no-freeze"], ["perf-scope", "everything"], ["mac-space", "low"],
  ]));
  assert.equal(r.status, "success", `status=${r.status}`);
  assert.equal(r.recommendedFix, REUSED.freeSpace, `fix=${r.recommendedFix} (slow path must be intact)`);
});

test("freeze/hang: failed force-quit escalates to the next untried cause", () => {
  const s = flow("performance", [
    ["perf-when", "today"], ["mac-freeze", "app-only"], ["perf-scope", "apps"], ["mac-space", "unsure"],
  ]);

  const r1 = E.analyze(s);
  assert.equal(r1.recommendedFix, REUSED.forceQuit, "force-quit must come first for a one-app hang");

  // All questions answered → afterFailedFix re-analyzes directly. The next
  // untried cause is the background-load tip (scored by perf-scope=apps).
  const r2 = E.afterFailedFix(s, REUSED.forceQuit);
  assert.equal(r2.status, "success", `status=${r2.status}`);
  assert.notEqual(r2.recommendedFix, REUSED.forceQuit, "tried force-quit must not be re-recommended");
  assert.ok(!r2.alternativeFixes.includes(REUSED.forceQuit), "tried force-quit must not appear as an alternative");
});

/* ---------- 4. exhaustion: every new path terminates honestly ------------- */
test("mac-performance and mac-hardware flows terminate at 'exhausted' (no loops)", () => {
  for (const [category, answers] of [
    ["performance", [["perf-when", "today"], ["mac-freeze", "app-only"], ["perf-scope", "apps"], ["mac-space", "unsure"]]],
    ["hardware", [["hw-mac-what", "input"]]],
  ]) {
    const s = flow(category, answers);
    let r = E.analyze(s);
    const tried = new Set();
    let guard = 0;
    while (r.status === "success" && r.recommendedFix && guard < 12) {
      assert.ok(!tried.has(r.recommendedFix), `${category}: re-recommended a tried fix: ${r.recommendedFix}`);
      tried.add(r.recommendedFix);
      r = E.afterFailedFix(s, r.recommendedFix);
      guard++;
    }
    assert.equal(guard, tried.size, `${category}: looped without progress`);
    assert.equal(r.status, "exhausted", `${category}: expected exhaustion after ${tried.size} distinct fixes (got ${r.status})`);
    assert.equal(r.recommendedFix, null, "exhaustion must not recommend a fix");
  }
});

/* ---------- 5. microphone: honest branch preserved + tips reachable ------- */
test("microphone: structured flow stays honestly insufficient; new tips are real and searchable", () => {
  // The mac-audio profile is single-pathway by design (Phase 3.2.3). Phase 3.3
  // deliberately did NOT add mic causes there — failed-fix escalation would
  // cross-recommend output fixes to mic users and vice versa. So the honest
  // insufficient branch must remain exactly as shipped.
  for (const [name, value] of [["Mic not heard", "mic"], ["One app only", "oneapp"]]) {
    const r = E.analyze(flow("audio", [["mac-audio-what", value]]));
    assert.equal(r.status, "insufficient", `${name}: status=${r.status}`);
    assert.equal(r.recommendedFix, null, `${name}: must not recommend a fix it has no evidence for`);
  }

  // Both new mic tips exist with complete safety metadata (schema.test.mjs
  // enforces the fields; here we pin the ids + platform).
  const { getFixBySlug } = knowledge;
  for (const slug of NEW_SLUGS.slice(1)) {
    const t = getFixBySlug(slug);
    assert.ok(t && typeof t.title === "string", `getFixBySlug("${slug}") must resolve`);
    assert.equal(t.cat, "mac", `${slug} must be a macOS tip`);
  }

  // Free-text search path: a vague mic complaint surfaces the input-device tip.
  const s = E.newSession(null);
  assert.ok(E.selectDevice(s, "mac").ok, "select mac");
  assert.ok(E.selectCategory(s, "something-else").ok, "something-else offered for mac");
  assert.ok(E.setDescription(s, "my mac microphone isn't working").ok, "description set");
  const r = E.analyze(s);
  const fixes = [r.recommendedFix, ...(r.alternativeFixes || [])].filter(Boolean);
  assert.ok(fixes.includes("no-microphone-on-your-mac-check-the-input-device-first"),
    `search should surface the input-device tip (got: ${fixes.join(", ")})`);
  assert.ok(fixes.includes("microphone-permission-on-your-mac-let-the-app-use-it"),
    `search should also surface the permission tip (got: ${fixes.join(", ")})`);
});

/* ---------- 6. platform guard: new Mac knowledge stays on Mac ------------- */
test("new Phase 3.3 fixes never leak into non-Mac profiles or flows", () => {
  const { getFixBySlug } = knowledge;
  const D = E.data;

  // Structural: no new slug referenced by any non-Mac profile (fix or alt).
  const leaks = [];
  for (const p of D.profiles) {
    if (p.devices.includes("mac")) continue;
    for (const c of p.causes || []) {
      if (NEW_SLUGS.includes(c.fix)) leaks.push(`${p.id}/${c.id} → ${c.fix}`);
      for (const a of c.alt || []) if (NEW_SLUGS.includes(a)) leaks.push(`${p.id}/${c.id} alt → ${a}`);
    }
  }
  assert.deepEqual(leaks, [], "new Mac-only fixes leaked into windows/other profiles: " + leaks.join(", "));

  // Structural: the new question is not in any non-Mac profile.
  const foreign = [];
  for (const p of D.profiles) {
    if (p.devices.includes("mac")) continue;
    for (const qid of p.questions || []) if (qid === "mac-freeze") foreign.push(`${p.id} → ${qid}`);
  }
  assert.deepEqual(foreign, [], "new Mac question leaked into non-Mac profiles: " + foreign.join(", "));

  // Engine-level, Mac direction: every reachable recommendation in the three
  // touched Mac flows must be a genuine macOS tip (cat === "mac").
  const TIPS = vm.runInThisContext("TIPS");
  const slugCat = new Map(TIPS.map((t) => [String(t.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""), t.cat]));
  for (const category of ["performance", "hardware"]) {
    const prof = D.profiles.find((p) => p.category === category && p.devices.includes("mac"));
    for (const qid of prof.questions) {
      for (const opt of D.questions[qid].options || []) {
        if (!opt.value) continue;
        const s = E.newSession(null);
        E.selectDevice(s, "mac");
        assert.ok(E.selectCategory(s, category).ok, `${category} offered for mac`);
        E.skipDescription(s);
        if (!E.answer(s, qid, opt.value).ok) continue; // gated question — covered elsewhere
        for (const q2 of prof.questions) {
          if (q2 === qid || s.answers[q2] !== undefined) continue;
          const first = D.questions[q2].options[0];
          if (!E.answer(s, q2, first.value).ok) break; // gated → fine
        }
        const r = E.analyze(s);
        if (r.recommendedFix) {
          assert.equal(slugCat.get(r.recommendedFix), "mac",
            `mac flow (${category}/${qid}=${opt.value}) recommended a non-Mac fix: ${r.recommendedFix}`);
        }
      }
    }
  }

  // Engine-level, Windows direction: no Mac-only Phase 3.3 fix may be served
  // by any Windows flow we touched vocabulary for (hardware + performance).
  for (const category of ["hardware", "performance"]) {
    const prof = D.profiles.find((p) => p.category === category && p.devices.includes("windows"));
    if (!prof) continue;
    for (const qid of prof.questions) {
      for (const opt of (D.questions[qid].options || []).slice(0, 3)) {
        const s = E.newSession(null);
        E.selectDevice(s, "windows");
        assert.ok(E.selectCategory(s, category).ok, `${category} offered for windows`);
        E.skipDescription(s);
        if (!E.answer(s, qid, opt.value).ok) continue;
        const r = E.analyze(s);
        assert.ok(!r.recommendedFix || !NEW_SLUGS.includes(r.recommendedFix),
          `windows ${category} flow recommended a Mac-only fix: ${r.recommendedFix}`);
      }
    }
  }

  // The existing macOS force-quit tip remains Mac-only (regression guard).
  assert.equal(getFixBySlug(REUSED.forceQuit).cat, "mac", "force-quit-a-frozen-app must stay a Mac tip");
});

/* ---------- 7. worker-side approved knowledge + data integrity ------------ */
test("worker sees the new question and fixes; data stays well-formed", () => {
  const { firstBranchQuestion, allApprovedQuestions, getFixBySlug } = knowledge;

  // Deterministic router: mac/performance still opens with perf-when (the new
  // question sits at position 2 — it must not steal the router's first turn).
  assert.equal(firstBranchQuestion("mac", "performance").id, "perf-when",
    "router must keep serving perf-when for mac/performance");
  assert.equal(firstBranchQuestion("mac", "hardware").id, "hw-mac-what",
    "router must keep serving hw-mac-what for mac/hardware");

  // The new question id is in the approved bank the worker validates against.
  const approved = allApprovedQuestions();
  const ids = (Array.isArray(approved) ? approved.map((q) => q && q.id).filter(Boolean) : Object.keys(approved || {}));
  assert.ok(ids.includes("mac-freeze"), "worker approved question set missing mac-freeze");

  // Every new fix id resolves in the worker's tip table.
  for (const slug of NEW_SLUGS) {
    const t = getFixBySlug(slug);
    assert.ok(t && typeof t.title === "string", `getFixBySlug("${slug}") must resolve`);
  }

  // Cause ids stay unique across all profiles.
  const D = E.data;
  const seenCauses = new Set();
  for (const p of D.profiles) {
    for (const c of p.causes || []) {
      assert.ok(!seenCauses.has(c.id), `duplicate cause id ${c.id} (${p.id})`);
      seenCauses.add(c.id);
    }
  }

  // Option values stay unique within each question (the engine matches by value).
  for (const [qid, q] of Object.entries(D.questions)) {
    const vals = (q.options || []).map((o) => o.value);
    assert.equal(new Set(vals).size, vals.length, `question ${qid} has duplicate option values`);
  }

  // mac-freeze exists in the bank AND is referenced by its profile.
  assert.ok(D.questions["mac-freeze"], "mac-freeze missing from question bank");
  const owner = D.profiles.find((p) => (p.questions || []).includes("mac-freeze"));
  assert.ok(owner && owner.id === "mac-performance", "mac-freeze must be referenced by mac-performance");

  // Every new cause is reachable: it has at least one scoring option.
  for (const cid of ["mac-perf-apphang", "mac-perf-freeze", "mac-perf-repeat", "mac-hw-input"]) {
    let reachable = false;
    for (const [qid, q] of Object.entries(D.questions)) {
      if ((q.options || []).some((o) => o.score && o.score[cid])) reachable = true;
    }
    const prof = D.profiles.find((p) => (p.causes || []).some((c) => c.id === cid));
    assert.ok(prof, `${cid} not in any profile`);
    assert.ok(reachable, `${cid} has no scoring option — unreachable`);
  }

  // Library totals after Phase 3.3: 86 + 3 new = 89 unique slugs.
  const TIPS = vm.runInThisContext("TIPS");
  assert.equal(TIPS.length, 89, `expected 89 tips (got ${TIPS.length})`);
  const slugs = TIPS.map((t) => String(t.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
  assert.equal(new Set(slugs).size, slugs.length, "fix ids (slugs) must stay unique");

  // The three new slugs are exactly what the titles generate (no drift).
  for (const slug of NEW_SLUGS) {
    const t = TIPS.find((x) => String(x.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") === slug);
    assert.ok(t, `no tip generates the expected slug ${slug}`);
  }

  // Pre-existing Mac fix ids still resolve (Phase 3.2.3 + originals sample).
  const PRE_EXISTING = [
    "fix-slow-wi-fi-on-your-mac",
    "force-quit-a-frozen-app",
    "speed-up-a-sluggish-macbook",
    "stop-apps-from-launching-at-login",
    "free-up-disk-space-with-storage-management",
    "reset-nvram-when-things-misbehave",
    "no-sound-on-your-mac-check-the-output-device-first",
    "external-monitor-not-detected-on-your-mac",
    "bluetooth-won-t-pair-on-your-mac-reset-it-properly",
  ];
  const missing = PRE_EXISTING.filter((s) => !getFixBySlug(s));
  assert.deepEqual(missing, [], "pre-existing Mac fix ids no longer resolve: " + missing.join(", "));
});
