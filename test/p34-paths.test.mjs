/* ============================================================
   EmTech Media — Phase 3.4 Mac microphone/input diagnostic pathway

   Implements the builder instruction §15 test matrix (cases 1–26) for the
   structured Mac microphone branch and the scoped trackpad/mouse branch:

     MICROPHONE (§2/§4/§5/§8)
       1  generic mic problem → honest insufficient, both approved mic tips
          offered as closest fixes, NO output tip anywhere
       2  fails everywhere (mac-mic-scope=everywhere) → input-device check FIRST
       3  works in other apps (scope=one-app) → PERMISSION fix first — never a
          global repair for an app-specific problem
       4  one-app failure ("doesn't work in zoom") → permission cause primary;
          free-text variant stays honestly insufficient with no output leak
       5  not detected / very quiet → input-device branch first; honest
          insufficient when signal is too weak (no risky fix invented)
       6  wrong input device → routes to the existing "check the input device
          first" tip, never a speaker/output fix
       7  permission ("zoom can't use my microphone") → permission cause
       8  exhaustion: both mic fixes tried → status exhausted, no new verdict
       9  NO unrelated output/speaker fix leaks at any round of either branch
      10  a tried fix is never re-recommended (success rounds) or re-listed

     TRACKPAD / MOUSE (§9)
      11  hw-mac-what=input → safe restart pass, primary mac-hw-input
      12  the safe restart tip comes first (medium confidence)
      13  failed restart → NVRAM reset escalates in
      14  NVRAM is REUSED (one existing tip, no duplicate created)
      15  both fail → honest exhaustion; no fix re-recommended during the loop

     CLASSIFIER (§12 — canonical vocabulary v1.3.0, BOTH runtimes agree)
      16  mic phrases → mac/audio intent
      17  Bluetooth pairing/connect phrasings → hardware (regression)
      18  "no sound" phrasings → audio (regression)
      19  Wi-Fi guard: "wifi won't connect" stays network

     PLATFORM GUARD (§13 — both directions, structural + engine-level)
      20  Windows flows never receive a Mac-only fix; the Windows mic branch
          resolves to the existing Windows microphone tip
      21  Mac mic/audio flows never receive a non-Mac fix

     KNOWLEDGE INTEGRITY (§14/§7 — reuse, no duplicates)
      22  89 tips / 89 unique slugs (no new tip was created in Phase 3.4)
      23  no duplicate questions; option values stay unique per question
      24  both new causes are reachable via scoring options AND keywords
      25  every cause fix/alt reference resolves in the worker's tip table
      26  both reused Mac mic tips carry complete safety metadata

     WORKER-SIDE (Phase 3.1.1 architecture untouched)
       * deterministic router still opens mac/audio with mac-audio-what and
         serves it for a mic phrase WITHOUT calling Qwen
       * mac-mic-scope is in the worker's approved question set

   The engine under test is the SAME diag-engine.js the browser runs; the data
   files are the same tips-data.js / diag-data.js the worker validates against.
   Run from the repo root:

     node --test test/p34-paths.test.mjs
   ============================================================ */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
   ids are in the approved sets the worker validates/routes against. */
const knowledge = await import(pathToFileURL(path.join(root, "ai-api", "src", "knowledge.js")).href);
const policy = await import(pathToFileURL(path.join(root, "ai-api", "src", "policy.js")).href);

/* ---------- Phase 3.4 fix ids (all REUSED tips — none are new) ----------- */
const MIC_INPUT = "no-microphone-on-your-mac-check-the-input-device-first";
const MIC_PERM = "microphone-permission-on-your-mac-let-the-app-use-it";
const OUTPUT = "no-sound-on-your-mac-check-the-output-device-first"; // must NEVER leak into mic branches
const RESTART_PASS = "trackpad-or-mouse-not-working-on-your-mac-the-safe-restart-pass";
const NVRAM = "reset-nvram-when-things-misbehave";
const WIN_MIC = "fix-a-microphone-no-one-can-hear"; // Windows mic tip (platform guard)

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

/* Description-driven session (free text only — the "generic problem" shape). */
function describe(text) {
  const s = E.newSession(null);
  assert.ok(E.selectDevice(s, "mac").ok, "select mac");
  assert.ok(E.selectCategory(s, "audio").ok, "audio offered for mac");
  assert.ok(E.setDescription(s, text).ok, `description set: ${text}`);
  return s;
}

/* Fail a fix and require the engine to hand back an analysis (no pending
   question — every mic-branch question is already answered in these flows). */
function failAndAnalyze(s, slug) {
  const r = E.afterFailedFix(s, slug);
  assert.notEqual(r.status, "continue", `unexpected pending question after failing ${slug}`);
  return r;
}

/* ============================================================
   MICROPHONE — cases 1–10 (§2/§4/§5/§8)
   ============================================================ */

test("mic 1: generic microphone problem → honest insufficient, both mic tips offered, no output tip", () => {
  const r = E.analyze(describe("my mac microphone isn't working"));
  assert.equal(r.status, "insufficient", `status=${r.status} (free text alone must not force a verdict)`);
  assert.equal(r.recommendedFix, null, "no fix without enough signal");
  const alts = r.alternativeFixes || [];
  assert.ok(alts.includes(MIC_INPUT), `input-device tip should be offered (got: ${alts.join(", ")})`);
  assert.ok(alts.includes(MIC_PERM), `permission tip should be offered (got: ${alts.join(", ")})`);
  assert.ok(!alts.includes(OUTPUT), "speaker/output fix must not leak into a microphone problem");
});

test("mic 2: fails in every app → input-device check FIRST, permission second", () => {
  const s = flow("audio", [["mac-audio-what", "mic"], ["mac-mic-scope", "everywhere"]]);
  const r1 = E.analyze(s);
  assert.equal(r1.status, "success", `status=${r1.status}`);
  assert.ok(["medium", "high"].includes(r1.confidence), `confidence=${r1.confidence}`);
  assert.equal(r1.recommendedFix, MIC_INPUT, `fix=${r1.recommendedFix} (everywhere → input device first)`);
  assert.ok(r1.primary && r1.primary.id === "mac-mic-input", `primary cause ${r1.primary && r1.primary.id} ≠ mac-mic-input`);
  assert.ok(r1.alternativeFixes.includes(MIC_PERM), "permission tip should be the listed alternative");

  // Escalation: input check fails → permission fix comes next (still in-group).
  const r2 = failAndAnalyze(s, MIC_INPUT);
  assert.equal(r2.status, "success", `status=${r2.status}`);
  assert.equal(r2.recommendedFix, MIC_PERM, `fix=${r2.recommendedFix} (permission escalates in)`);
});

test("mic 3: works in other apps → PERMISSION fix first — no global repair for an app-specific problem", () => {
  const s = flow("audio", [["mac-audio-what", "mic"], ["mac-mic-scope", "one-app"]]);
  const r1 = E.analyze(s);
  assert.equal(r1.status, "success", `status=${r1.status}`);
  assert.equal(r1.recommendedFix, MIC_PERM, `fix=${r1.recommendedFix} (one app → permission first)`);
  assert.ok(r1.primary && r1.primary.id === "mac-mic-perm", `primary cause ${r1.primary && r1.primary.id} ≠ mac-mic-perm`);
  assert.ok(r1.alternativeFixes.includes(MIC_INPUT), "input-device tip should be the listed alternative");

  // Escalation: permission fix fails → input check comes next (still in-group).
  const r2 = failAndAnalyze(s, MIC_PERM);
  assert.equal(r2.status, "success", `status=${r2.status}`);
  assert.equal(r2.recommendedFix, MIC_INPUT, `fix=${r2.recommendedFix} (input check escalates in)`);
});

test("mic 4: one-app failure ('doesn't work in zoom') → permission cause; free text stays honest", () => {
  // Structured branch names the permission cause.
  const s = flow("audio", [["mac-audio-what", "mic"], ["mac-mic-scope", "one-app"]]);
  const r1 = E.analyze(s);
  assert.equal(r1.primary.id, "mac-mic-perm", `primary=${r1.primary && r1.primary.id}`);

  // Free-text variant: one keyword hit is not enough for a verdict — the engine
  // must stay honest and still keep everything inside the input group.
  const r = E.analyze(describe("my microphone doesn't work in zoom"));
  assert.equal(r.status, "insufficient", `status=${r.status}`);
  assert.equal(r.recommendedFix, null, "no verdict from a single keyword hit");
  const alts = r.alternativeFixes || [];
  assert.ok(alts.includes(MIC_PERM), `permission tip should be offered (got: ${alts.join(", ")})`);
  assert.ok(!alts.includes(OUTPUT), "output fix must not leak into a one-app mic problem");
});

test("mic 5: not detected / very quiet → input-device branch first; weak signal stays honest", () => {
  // Structured: 'everywhere' is the detection/settings branch — input tip first.
  const s = flow("audio", [["mac-audio-what", "mic"], ["mac-mic-scope", "everywhere"]]);
  assert.equal(E.analyze(s).recommendedFix, MIC_INPUT, "not-detected users get the input-device check");

  // Free-text variants: honest insufficient, input tip listed first, no output.
  for (const text of ["my mac doesn't detect my microphone", "my mac microphone is very quiet"]) {
    const r = E.analyze(describe(text));
    assert.equal(r.status, "insufficient", `"${text}": status=${r.status}`);
    assert.equal(r.recommendedFix, null, `"${text}": no invented fix`);
    const alts = r.alternativeFixes || [];
    assert.ok(alts.includes(MIC_INPUT), `"${text}": input tip offered (got: ${alts.join(", ")})`);
    assert.ok(!alts.includes(OUTPUT), `"${text}": output fix must not leak`);
  }
});

test("mic 6: wrong input device → existing 'check the input device first' tip, never an output fix", () => {
  const s = flow("audio", [["mac-audio-what", "mic"], ["mac-mic-scope", "everywhere"]]);
  const r1 = E.analyze(s);
  assert.equal(r1.recommendedFix, MIC_INPUT, `fix=${r1.recommendedFix}`);

  // The reused tip really is the input-device procedure (title check).
  const t = knowledge.getFixBySlug(MIC_INPUT);
  assert.ok(t && /input device/i.test(t.title), "reused tip must be the input-device one");

  const r = E.analyze(describe("my mac is using the wrong microphone"));
  const alts = r.alternativeFixes || [];
  assert.ok(alts.includes(MIC_INPUT), `wrong-input users get the input tip (got: ${alts.join(", ")})`);
  assert.ok(!alts.includes(OUTPUT), "output fix must not leak into a wrong-input problem");
});

test("mic 7: permission ('zoom can't use my microphone') → permission cause is reachable and primary in one-app branch", () => {
  const s = flow("audio", [["mac-audio-what", "mic"], ["mac-mic-scope", "one-app"]]);
  const r1 = E.analyze(s);
  assert.equal(r1.primary.id, "mac-mic-perm", `primary=${r1.primary && r1.primary.id}`);
  assert.equal(r1.recommendedFix, MIC_PERM, `fix=${r1.recommendedFix}`);

  // Free-text variant stays honest (one keyword hit) but keeps the permission
  // tip in the offered set and nothing output-shaped anywhere.
  const r = E.analyze(describe("zoom can't use my microphone"));
  assert.equal(r.status, "insufficient", `status=${r.status}`);
  const alts = r.alternativeFixes || [];
  assert.ok(alts.includes(MIC_PERM), `permission tip offered (got: ${alts.join(", ")})`);
  assert.ok(!alts.includes(OUTPUT), "output fix must not leak into a permission problem");
});

test("mic 8+9: exhaustion after both mic fixes — honest, and NO output/speaker fix at any round", () => {
  for (const [name, answers] of [
    ["everywhere branch", [["mac-audio-what", "mic"], ["mac-mic-scope", "everywhere"]]],
    ["one-app branch", [["mac-audio-what", "mic"], ["mac-mic-scope", "one-app"]]],
  ]) {
    const s = flow("audio", answers);
    let r = E.analyze(s);
    const tried = [];
    // Walk the whole branch to exhaustion, checking every round.
    for (let i = 0; i < 4 && r.status === "success" && r.recommendedFix; i++) {
      assert.ok(!tried.includes(r.recommendedFix), `${name}: re-recommended a tried fix: ${r.recommendedFix}`);
      tried.push(r.recommendedFix);
      // Case 9 — the output/speaker tip must never appear in ANY round.
      assert.notEqual(r.recommendedFix, OUTPUT, `${name} r${i + 1}: output fix leaked into mic branch`);
      for (const a of r.alternativeFixes || []) {
        assert.notEqual(a, OUTPUT, `${name} r${i + 1}: output tip listed as alternative in mic branch`);
      }
      r = failAndAnalyze(s, r.recommendedFix);
    }
    // Case 8 — both fixes tried → honest exhaustion with no new verdict.
    assert.equal(r.status, "exhausted", `${name}: status=${r.status} after ${tried.length} distinct fixes`);
    assert.equal(r.recommendedFix, null, `${name}: exhaustion must not recommend a fix`);
    // The exhausted "all fixes in this area" list stays inside the input group.
    const alts = r.alternativeFixes || [];
    for (const f of [MIC_INPUT, MIC_PERM]) assert.ok(alts.includes(f), `${name}: ${f} missing from exhaustion list`);
    assert.ok(!alts.includes(OUTPUT), `${name}: output tip leaked into the exhausted mic branch`);
  }

  // And the output branch is still fully reachable when the user explicitly
  // points at speakers (§8: leakage only stops in one direction).
  const s = flow("audio", [["mac-audio-what", "speakers"], ["mac-audio-where", "nothing-works"]]);
  const r = E.analyze(s);
  assert.equal(r.status, "success", `output branch status=${r.status}`);
  assert.equal(r.recommendedFix, OUTPUT, "explicit output problem still gets the output tip");
});

test("mic 10: a tried fix is never re-recommended or re-listed as an alternative (either branch)", () => {
  const s = flow("audio", [["mac-audio-what", "mic"], ["mac-mic-scope", "everywhere"]]);
  const r1 = E.analyze(s);
  assert.equal(r1.recommendedFix, MIC_INPUT, "input tip first");

  const r2 = failAndAnalyze(s, MIC_INPUT);
  assert.notEqual(r2.recommendedFix, MIC_INPUT, "tried input tip must not be re-recommended");
  assert.ok(!(r2.alternativeFixes || []).includes(MIC_INPUT), "tried input tip must not be listed as an alternative");

  const r3 = failAndAnalyze(s, MIC_PERM);
  assert.equal(r3.status, "exhausted", `status=${r3.status}`);
  assert.equal(r3.recommendedFix, null, "no re-recommendation at exhaustion");
});

/* ============================================================
   TRACKPAD / MOUSE — cases 11–15 (§9)
   ============================================================ */

test("trackpad 11+12: input branch → safe restart pass FIRST (medium confidence), primary mac-hw-input", () => {
  const s = flow("hardware", [["hw-mac-what", "input"]]);
  const r1 = E.analyze(s);
  assert.equal(r1.status, "success", `status=${r1.status}`);
  assert.equal(r1.confidence, "medium", `confidence=${r1.confidence}`);
  assert.equal(r1.recommendedFix, RESTART_PASS, `fix=${r1.recommendedFix} (safe restart pass first)`);
  assert.ok(r1.primary && r1.primary.id === "mac-hw-input", `primary cause ${r1.primary && r1.primary.id} ≠ mac-hw-input`);
});

test("trackpad 13+14: failed restart → NVRAM reset escalates in (REUSED existing tip, no duplicate)", () => {
  const s = flow("hardware", [["hw-mac-what", "input"]]);
  E.analyze(s);
  const r2 = failAndAnalyze(s, RESTART_PASS);
  assert.equal(r2.status, "success", `status=${r2.status}`);
  assert.equal(r2.recommendedFix, NVRAM, `fix=${r2.recommendedFix} (NVRAM reset escalates in)`);

  // Reuse proof: exactly ONE tip generates the NVRAM slug, and the input cause
  // references it via alt (not a second copy of the procedure).
  const TIPS = vm.runInThisContext("TIPS");
  const tipSlugFn = vm.runInThisContext("tipSlug");
  const matches = TIPS.filter((t) => {
    try { return tipSlugFn(t.title) === NVRAM; } catch (err) { return false; }
  });
  assert.equal(matches.length, 1, `expected exactly one NVRAM tip in the library (got ${matches.length})`);
  const D = E.data;
  const cause = D.profiles.find((p) => p.id === "mac-hardware").causes.find((c) => c.id === "mac-hw-input");
  assert.ok(cause.alt.includes(NVRAM), "input cause must reference the reused NVRAM tip via alt");
});

test("trackpad 15: both fixes fail → honest exhaustion; nothing re-recommended during the loop", () => {
  const s = flow("hardware", [["hw-mac-what", "input"]]);
  let r = E.analyze(s);
  const tried = new Set();
  let guard = 0;
  while (r.status === "success" && r.recommendedFix && guard < 12) {
    assert.ok(!tried.has(r.recommendedFix), `re-recommended a tried fix: ${r.recommendedFix}`);
    tried.add(r.recommendedFix);
    r = failAndAnalyze(s, r.recommendedFix);
    guard++;
  }
  assert.equal(guard, tried.size, "looped without progress");
  assert.deepEqual([...tried].sort(), [NVRAM, RESTART_PASS].sort(),
    `input branch should exhaust after exactly its two fixes (got: ${[...tried].join(", ")})`);
  assert.equal(r.status, "exhausted", `status=${r.status}`);
  assert.equal(r.recommendedFix, null, "exhaustion must not recommend a fix");
});

/* ============================================================
   CLASSIFIER — cases 16–19 (§12; canonical vocabulary v1.3.0)
   ============================================================ */

test("classifier 16: microphone phrases classify as mac/audio on BOTH runtimes", () => {
  const cases = [
    ["my mac microphone isn't working", "mac", "audio"],
    ["my mac microphone doesn't work in zoom", "mac", "audio"], // app-specific stays audio intent
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

test("classifier 17+18: Bluetooth hardware and audio regressions hold on BOTH runtimes", () => {
  const cases = [
    ["my bluetooth headphones won't connect", "hardware"], // pairing/connect → hardware
    ["my bluetooth headphones won't pair", "hardware"],
    ["my mac has no sound", "audio"],                      // plain silence → audio
    ["my bluetooth headphones have no sound", "audio"],    // sound dominates the headphone word
  ];
  const failures = [];
  for (const [input, wantCat] of cases) {
    if (K.classifyProblem(input).category !== wantCat) failures.push(`browser: "${input}" → ${K.classifyProblem(input).category}`);
    if (policy.clearWinner(policy.classifyText(input).scores) !== wantCat) failures.push(`worker:  "${input}" → ${policy.clearWinner(policy.classifyText(input).scores)}`);
  }
  assert.deepEqual(failures, [], failures.join("; "));
});

test("classifier 19: Wi-Fi guard — 'wifi won't connect' stays network; vocabulary still v1.3.0", () => {
  const phrase = "my wifi won't connect on my mac";
  assert.equal(K.classifyProblem(phrase).category, "network", `browser: ${K.classifyProblem(phrase).category}`);
  assert.equal(policy.clearWinner(policy.classifyText(phrase).scores), "network", "worker must not pull it into hardware");

  const words = globalThis.EmTechClassificationWords;
  assert.equal(words.version, "1.3.0", `classification-words.js version=${words.version} (Phase 3.4 adds no vocabulary)`);
});

/* ============================================================
   PLATFORM GUARD — cases 20–21 (§13, both directions)
   ============================================================ */

test("platform 20: Windows flows never receive a Mac-only fix; the Windows mic branch keeps its own tip", () => {
  const D = E.data;
  const TIPS = vm.runInThisContext("TIPS");
  const slugCat = new Map(TIPS.map((t) => [String(t.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""), t.cat]));

  // Structural: no non-Mac profile may reference the Mac mic tips (fix or alt),
  // and the new question must not sit in any non-Mac profile.
  const leaks = [];
  for (const p of D.profiles) {
    if (p.devices.includes("mac")) continue;
    for (const c of p.causes || []) {
      if ([MIC_INPUT, MIC_PERM].includes(c.fix)) leaks.push(`${p.id}/${c.id} → ${c.fix}`);
      for (const a of c.alt || []) if ([MIC_INPUT, MIC_PERM].includes(a)) leaks.push(`${p.id}/${c.id} alt → ${a}`);
    }
    for (const qid of p.questions || []) if (qid === "mac-mic-scope") leaks.push(`${p.id} → ${qid}`);
  }
  assert.deepEqual(leaks, [], "Mac mic knowledge leaked into non-Mac profiles: " + leaks.join(", "));

  // Engine-level: the Windows microphone branch resolves to the WINDOWS tip.
  const s = E.newSession(null);
  E.selectDevice(s, "windows");
  assert.ok(E.selectCategory(s, "audio").ok, "audio offered for windows");
  E.skipDescription(s);
  assert.ok(E.answer(s, "audio-what", "mic").ok, "answer audio-what=mic (windows)");
  const r = E.analyze(s);
  assert.equal(r.recommendedFix, WIN_MIC, `fix=${r.recommendedFix} (windows mic branch keeps its own tip)`);
  assert.equal(slugCat.get(WIN_MIC), "windows", "the Windows mic tip must be a windows tip");

  // Engine-level sweep: every reachable recommendation in the win-audio flow is
  // non-Mac.
  const prof = D.profiles.find((p) => p.id === "win-audio");
  for (const qid of prof.questions) {
    for (const opt of D.questions[qid].options || []) {
      if (!opt.value) continue;
      const s2 = E.newSession(null);
      E.selectDevice(s2, "windows"); E.selectCategory(s2, "audio"); E.skipDescription(s2);
      if (!E.answer(s2, qid, opt.value).ok) continue; // gated — fine
      for (const q2 of prof.questions) {
        if (q2 === qid || s2.answers[q2] !== undefined) continue;
        const first = D.questions[q2].options[0];
        if (!E.answer(s2, q2, first.value).ok) break; // gated → fine
      }
      const r2 = E.analyze(s2);
      if (r2.recommendedFix) {
        assert.notEqual(slugCat.get(r2.recommendedFix), "mac",
          `windows audio flow (${qid}=${opt.value}) recommended a Mac-only fix: ${r2.recommendedFix}`);
      }
    }
  }
});

test("platform 21: Mac mic/audio flows never receive a non-Mac fix (every option, every round)", () => {
  const D = E.data;
  const TIPS = vm.runInThisContext("TIPS");
  const slugCat = new Map(TIPS.map((t) => [String(t.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""), t.cat]));

  // Structural: the Mac mic tips are mac-only in the library.
  assert.equal(slugCat.get(MIC_INPUT), "mac", `${MIC_INPUT} must be a macOS tip`);
  assert.equal(slugCat.get(MIC_PERM), "mac", `${MIC_PERM} must be a macOS tip`);

  // Engine-level: walk EVERY first-answer branch of the mac-audio profile and
  // complete each flow with its visible follow-up questions — this includes
  // the new mic-mic-scope branch. Every recommendation must be a Mac tip.
  const prof = D.profiles.find((p) => p.id === "mac-audio");
  let checked = 0;
  for (const opt of D.questions["mac-audio-what"].options || []) {
    if (!opt.value) continue;
    const s = E.newSession(null);
    E.selectDevice(s, "mac"); E.selectCategory(s, "audio"); E.skipDescription(s);
    assert.ok(E.answer(s, "mac-audio-what", opt.value).ok, `answer mac-audio-what=${opt.value}`);
    for (const q2 of prof.questions) {
      if (q2 === "mac-audio-what" || s.answers[q2] !== undefined) continue;
      const first = D.questions[q2].options[0];
      if (!E.answer(s, q2, first.value).ok) break; // gated → fine
    }
    const r = E.analyze(s);
    checked++;
    if (r.recommendedFix) {
      assert.equal(slugCat.get(r.recommendedFix), "mac",
        `mac audio flow (what=${opt.value}) recommended a non-Mac fix: ${r.recommendedFix}`);
    }
  }
  // One path per mac-audio-what option; the mic branch must have walked through
  // mac-mic-scope (its first visible follow-up) to count as exercised.
  assert.equal(checked, D.questions["mac-audio-what"].options.length,
    `expected one walk per what-option (got ${checked})`);
  const sMic = E.newSession(null);
  E.selectDevice(sMic, "mac"); E.selectCategory(sMic, "audio"); E.skipDescription(sMic);
  assert.ok(E.answer(sMic, "mac-audio-what", "mic").ok, "answer mic");
  assert.ok(E.answer(sMic, "mac-mic-scope", D.questions["mac-mic-scope"].options[0].value).ok,
    "scope branch reachable in the platform sweep");
  const rMic = E.analyze(sMic);
  if (rMic.recommendedFix) {
    assert.equal(slugCat.get(rMic.recommendedFix), "mac", `mic scope branch recommended a non-Mac fix: ${rMic.recommendedFix}`);
  }
});

/* ============================================================
   KNOWLEDGE INTEGRITY — cases 22–26 (§7/§14)
   ============================================================ */

test("knowledge 22: library stays at 89 tips / 89 unique slugs (Phase 3.4 created NO new tip)", () => {
  const TIPS = vm.runInThisContext("TIPS");
  assert.equal(TIPS.length, 89, `expected 89 tips (got ${TIPS.length})`);
  const slugs = TIPS.map((t) => String(t.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
  assert.equal(new Set(slugs).size, slugs.length, "fix ids (slugs) must stay unique");
});

test("knowledge 23: no duplicate questions; option values stay unique per question", () => {
  const D = E.data;
  // Question ids are object keys in the bank (unique by construction); what
  // can break is a profile referencing a missing id or listing one twice.
  // (Sharing one question across platform profiles — e.g. perf-when on win +
  // mac + other — is the shipped design, so cross-profile sharing is allowed.)
  for (const p of D.profiles) {
    const qs = p.questions || [];
    assert.equal(new Set(qs).size, qs.length, `${p.id} lists a question twice`);
    for (const qid of qs) assert.ok(D.questions[qid], `${p.id} references unknown question ${qid}`);
  }

  // Phase 3.4's new question is a single bank entry referenced by exactly one
  // profile — no second copy of an existing question was created.
  const owners = D.profiles.filter((p) => (p.questions || []).includes("mac-mic-scope")).map((p) => p.id);
  assert.deepEqual(owners, ["mac-audio"], `mac-mic-scope must be owned by exactly mac-audio (got: ${owners.join(", ")})`);

  // Option values unique within each question (the engine matches by value).
  for (const [qid, q] of Object.entries(D.questions)) {
    const vals = (q.options || []).map((o) => o.value);
    assert.equal(new Set(vals).size, vals.length, `question ${qid} has duplicate option values`);
  }

  // Cause ids stay unique across all profiles.
  const seen = new Set();
  for (const p of D.profiles) {
    for (const c of p.causes || []) {
      assert.ok(!seen.has(c.id), `duplicate cause id ${c.id} (${p.id})`);
      seen.add(c.id);
    }
  }
});

test("knowledge 24: both new Phase 3.4 causes exist, are grouped 'input', and reachable", () => {
  const D = E.data;
  const prof = D.profiles.find((p) => p.id === "mac-audio");
  assert.ok(prof, "mac-audio profile exists");

  for (const cid of ["mac-mic-input", "mac-mic-perm"]) {
    const cause = prof.causes.find((c) => c.id === cid);
    assert.ok(cause, `${cid} missing from mac-audio`);
    assert.equal(cause.group, "input", `${cid} must belong to the scoped input group`);

    // Reachable via at least one scoring option AND carries keywords.
    let reachable = false;
    for (const [qid, q] of Object.entries(D.questions)) {
      if ((q.options || []).some((o) => o.score && o.score[cid])) reachable = true;
    }
    assert.ok(reachable, `${cid} has no scoring option — unreachable`);
    assert.ok(cause.keywords && cause.keywords.length, `${cid} should carry keywords for free-text signal`);

    // Its fix resolves and is a Mac tip.
    const t = knowledge.getFixBySlug(cause.fix);
    assert.ok(t && typeof t.title === "string", `${cid}: fix ${cause.fix} must resolve`);
    assert.equal(t.cat, "mac", `${cid}: fix ${cause.fix} must be a macOS tip`);
  }

  // The output cause keeps its own group (the scoping boundary).
  const out = prof.causes.find((c) => c.id === "mac-aud-output");
  assert.equal(out.group, "output", "mac-aud-output must stay in the output group");
});

test("knowledge 25: every cause fix/alt reference across ALL profiles resolves in the worker's tip table", () => {
  const D = E.data;
  const broken = [];
  for (const p of D.profiles) {
    for (const c of p.causes || []) {
      if (!knowledge.getFixBySlug(c.fix)) broken.push(`${p.id}/${c.id} → ${c.fix}`);
      for (const a of c.alt || []) if (!knowledge.getFixBySlug(a)) broken.push(`${p.id}/${c.id} alt → ${a}`);
    }
  }
  assert.deepEqual(broken, [], "broken cause→fix references: " + broken.join("; "));

  // The two reused mic tips resolve on the worker side with Mac platform.
  for (const slug of [MIC_INPUT, MIC_PERM]) {
    const t = knowledge.getFixBySlug(slug);
    assert.ok(t && typeof t.title === "string", `getFixBySlug("${slug}") must resolve`);
    assert.equal(t.cat, "mac", `${slug} must be a macOS tip`);
  }
});

test("knowledge 26: both reused Mac mic tips carry complete safety metadata (§6)", () => {
  for (const slug of [MIC_INPUT, MIC_PERM]) {
    const t = knowledge.getFixBySlug(slug);
    assert.ok(t, `${slug} must resolve`);
    assert.equal(typeof t.risk_level, "string", `${slug}: risk_level missing`);
    assert.ok(["low", "medium", "high"].includes(t.risk_level), `${slug}: risk_level=${t.risk_level}`);
    assert.equal(t.reversible, true, `${slug}: must be reversible`);
    assert.ok(typeof t.verification === "string" && t.verification.trim().length > 0, `${slug}: verification missing`);
    const fc = t.failure_conditions;
    assert.ok((Array.isArray(fc) && fc.length > 0) || (typeof fc === "string" && fc.trim().length > 0),
      `${slug}: failure_conditions missing`);
    assert.ok(Array.isArray(t.steps) && t.steps.length > 0, `${slug}: steps missing`);
  }
});

/* ============================================================
   WORKER-SIDE — Phase 3.1.1 architecture untouched (§12/§15)
   ============================================================ */

test("worker: deterministic router still opens mac/audio with mac-audio-what and serves it for a mic phrase (no Qwen)", () => {
  // First turn of the branch is unchanged — the new question sits at position 2.
  assert.equal(knowledge.firstBranchQuestion("mac", "audio").id, "mac-audio-what",
    "router must keep serving mac-audio-what for mac/audio");

  // The new question id is in the approved bank the worker validates against.
  const ids = knowledge.approvedQuestionIds();
  assert.ok(ids.has("mac-mic-scope"), "worker approved question set missing mac-mic-scope");
  assert.ok(ids.has("mac-audio-what") && ids.has("mac-audio-where"), "existing audio questions still approved");

  // A mic phrase routes deterministically to the first branch question —
  // this turn never burns a Qwen call.
  const route = policy.deterministicRoute({ context: {}, lastUserText: "my mac microphone isn't working" });
  assert.ok(route, "mic phrase must be deterministic-routable");
  assert.equal(route.status, "question", `route status=${route && route.status}`);
  assert.equal(route.platform, "mac", `platform=${route && route.platform}`);
  assert.equal(route.category, "audio", `category=${route && route.category}`);
  assert.equal(route.question.id, "mac-audio-what", `question id=${route && route.question && route.question.id}`);
  assert.equal(route.recommended_fix, null, "router must not recommend a fix on the first turn");

  // The app-specific phrasing routes to the same branch (audio intent).
  const r2 = policy.deterministicRoute({ context: {}, lastUserText: "my mac microphone doesn't work in zoom" });
  assert.ok(r2 && r2.category === "audio", `app-specific mic phrase must stay audio (got ${r2 && r2.category})`);
});
