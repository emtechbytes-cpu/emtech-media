/* ============================================================
   EmTech AI — Phase 3.2.3 macOS P1 diagnostic expansion pathway tests

   Exercises the four new Mac pathways end-to-end at the deterministic
   layer (no network, no model calls):

     WI-FI WON'T CONNECT (mac-network extended)
       net-state=off → safe toggle fix FIRST (existing slow-Wi-Fi tip reused)
         → failed fix → medium-risk network reset escalates in
           → both fail → exhausted, nothing re-recommended
       net-state=connected-nointernet → same safe-first order

     NO SOUND (new mac-audio profile — audio was Windows-only before)
       speakers + nothing-works → output-device tip (high confidence)
       mic / one-app answers → honestly 'insufficient' until Phase 3.4 (§2/§5)
         wires the two approved mic tips in behind mac-mic-scope; a bare mic
         answer still gets no verdict, and output fixes never leak into it
       single cause → after its fix fails → exhausted

     EXTERNAL DISPLAY (mac-hardware extended)
       hw-mac-what=display → new display tip FIRST
         → failed fix → NVRAM reset (existing tip reused) escalates in

     BLUETOOTH PAIRING (mac-hardware extended)
       hw-mac-what=bluetooth → new pairing tip

   Plus: showIf gating on mac-audio-where, platform guard (Mac flows must
   never be served Windows-only fixes and vice versa), worker-side approved
   question/fix availability, failed-fix progression and data integrity.

   The engine under test is the SAME diag-engine.js the browser runs;
   the data files are the same tips-data.js / diag-data.js the worker
   validates against. Run from the repo root:

     node --test ai-api/test/p323-paths.test.mjs
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

/* Worker-side knowledge (same files, CJS/ESM shim) — proves the new ids are
   in the approved set the worker validates against. */
const knowledge = await import(pathToFileURL(path.join(root, "ai-api", "src", "knowledge.js")).href);

/* ---------- the four new Phase 3.2.3 fix ids (slugs) ---------------------- */
const NEW_SLUGS = [
  "connected-but-no-internet-on-your-mac-the-safe-network-reset",
  "no-sound-on-your-mac-check-the-output-device-first",
  "external-monitor-not-detected-on-your-mac",
  "bluetooth-won-t-pair-on-your-mac-reset-it-properly",
];
const REUSED = {
  slowWifi: "fix-slow-wi-fi-on-your-mac",
  nvram: "reset-nvram-when-things-misbehave",
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

/* ---------- 1. router: the four gap phrases classify deterministically ---- */
test("router classifies the Phase 3.2.3 Mac phrases (no Qwen needed)", () => {
  const cases = [
    ["my mac wifi isn't working", "mac", "network"],
    ["no sound on my macbook", "mac", "audio"],
    ["external monitor not detected on my mac", "mac", "hardware"],
    ["bluetooth won't pair with my mac", "mac", "hardware"],
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
  const up = K.classifyProblem("i want to upgrade my ram on my mac");
  assert.equal(up.category, "hardware", `"upgrade my ram" should stay hardware (got ${up.category})`);
  const slow = K.classifyProblem("my mac is slow when i open apps");
  assert.equal(slow.category, "performance", `"my mac is slow" must stay performance (got ${slow.category})`);
});

/* ---------- 2. question wiring: order + showIf gating --------------------- */
test("new questions sit in their profiles; mac-audio-where stays gated", () => {
  const D = E.data;
  const byId = (id) => D.profiles.find((p) => p.id === id);

  assert.deepEqual(byId("mac-network").questions, ["net-state", "net-when", "net-scope"],
    "mac-network order: state → when → scope (state first so the router serves it)");
  /* Phase 3.4 (§2/§5) — the microphone scope split sits between "what" and
     "where": a mic answer now routes through mac-mic-scope (every app vs one
     app), so the profile order is what → mic-scope → where. */
  assert.deepEqual(byId("mac-audio").questions, ["mac-audio-what", "mac-mic-scope", "mac-audio-where"],
    "mac-audio order: what → mic scope → where (Phase 3.4 §5)");
  assert.ok(D.questions["mac-audio-what"] && D.questions["mac-audio-where"], "both audio questions exist in the bank");

  // mac-audio-where must be rejected before its parent answer (showIf).
  const s = E.newSession(null);
  E.selectDevice(s, "mac");
  assert.ok(E.selectCategory(s, "audio").ok, "audio now offered for mac");
  E.skipDescription(s);
  assert.equal(E.answer(s, "mac-audio-where", "nothing-works").ok, false,
    "gated question rejected before mac-audio-what is answered");

  // Non-output branches (mic / one app) → still gated.
  for (const v of ["mic", "oneapp"]) {
    const s2 = E.newSession(null);
    E.selectDevice(s2, "mac"); E.selectCategory(s2, "audio"); E.skipDescription(s2);
    assert.ok(E.answer(s2, "mac-audio-what", v).ok, `answer mac-audio-what=${v}`);
    assert.equal(E.answer(s2, "mac-audio-where", "nothing-works").ok, false,
      `gated question rejected for the ${v} branch`);
  }

  /* Phase 3.4 (§5) — mac-mic-scope is gated on a mic answer: rejected before
     mac-audio-what, accepted right after "mic", and still hidden for oneapp. */
  const sMic = E.newSession(null);
  E.selectDevice(sMic, "mac"); E.selectCategory(sMic, "audio"); E.skipDescription(sMic);
  assert.equal(E.answer(sMic, "mac-mic-scope", "everywhere").ok, false,
    "mac-mic-scope rejected before mac-audio-what is answered");
  assert.ok(E.answer(sMic, "mac-audio-what", "mic").ok, "answer mic");
  assert.equal(E.answer(sMic, "mac-mic-scope", "everywhere").ok, true,
    "mac-mic-scope accepted once mac-audio-what=mic");
  const sOne = E.newSession(null);
  E.selectDevice(sOne, "mac"); E.selectCategory(sOne, "audio"); E.skipDescription(sOne);
  assert.ok(E.answer(sOne, "mac-audio-what", "oneapp").ok, "answer oneapp");
  assert.equal(E.answer(sOne, "mac-mic-scope", "everywhere").ok, false,
    "mac-mic-scope stays hidden for the one-app branch");

  // Output-silence branches → visible and accepted.
  for (const v of ["speakers", "both"]) {
    const s3 = E.newSession(null);
    E.selectDevice(s3, "mac"); E.selectCategory(s3, "audio"); E.skipDescription(s3);
    assert.ok(E.answer(s3, "mac-audio-what", v).ok, `answer mac-audio-what=${v}`);
    assert.ok(E.answer(s3, "mac-audio-where", "nothing-works").ok,
      `gated question accepted once mac-audio-what=${v}`);
  }

  // hw-mac-what gained the two new branches without touching existing ones.
  const opts = Object.fromEntries(D.questions["hw-mac-what"].options.map((o) => [o.value, o]));
  assert.ok(opts.display && opts.bluetooth, "display + bluetooth options present");
  assert.equal(opts.battery.score["mac-hw-battery"], 3, "existing battery option untouched");
  assert.equal(opts.drives.score["mac-hw-drives"], 3, "existing drives option untouched");
});

/* ---------- 3. pathway resolution: cause → approved fix ------------------- */
test("every Phase 3.2.3 pathway resolves to its intended approved fix", () => {
  const cases = [
    ["Wi-Fi off/missing → SAFE toggle tip first (existing reuse)", "network",
      [["net-state", "off"], ["net-when", "random"], ["net-scope", "one"]],
      REUSED.slowWifi, "mac-net-off", "medium"],
    ["Connected but no internet → SAFE toggle tip FIRST, reset second", "network",
      [["net-state", "connected-nointernet"], ["net-when", "random"], ["net-scope", "one"]],
      REUSED.slowWifi, "mac-net-wifi", "high"],
    ["Drops in and out → existing slow-Wi-Fi tip", "network",
      [["net-state", "drops"], ["net-when", "random"], ["net-scope", "one"]],
      REUSED.slowWifi, "mac-net-wifi", "high"],
    ["No sound: speakers silent everywhere → output-device tip (new)", "audio",
      [["mac-audio-what", "speakers"], ["mac-audio-where", "nothing-works"]],
      NEW_SLUGS[1], "mac-aud-output", "high"],
    ["External monitor not detected → new display tip FIRST", "hardware",
      [["hw-mac-what", "display"]],
      NEW_SLUGS[2], "mac-hw-display", "medium"],
    ["Bluetooth won't pair → new pairing tip (new)", "hardware",
      [["hw-mac-what", "bluetooth"]],
      NEW_SLUGS[3], "mac-hw-bluetooth", "medium"],
  ];

  for (const [name, category, answers, wantFix, wantCause, wantConf] of cases) {
    const r = E.analyze(flow(category, answers));
    assert.equal(r.status, "success", `${name}: status=${r.status}`);
    assert.equal(r.confidence, wantConf, `${name}: confidence=${r.confidence} (wanted ${wantConf})`);
    assert.equal(r.recommendedFix, wantFix, `${name}: fix=${r.recommendedFix}`);
    assert.ok(r.primary && r.primary.id === wantCause, `${name}: primary cause ${r.primary && r.primary.id} ≠ ${wantCause}`);
  }

  // Honest 'insufficient' branches: no approved Mac mic/one-app fix exists, so
  // the engine must NOT invent a recommendation.
  for (const [name, answers] of [
    ["Mic not heard", [["mac-audio-what", "mic"]]],
    ["One app only", [["mac-audio-what", "oneapp"]]],
  ]) {
    const r = E.analyze(flow("audio", answers));
    assert.equal(r.status, "insufficient", `${name}: status=${r.status}`);
    assert.equal(r.recommendedFix, null, `${name}: must not recommend a fix it has no evidence for`);
  }
});

/* ---------- 4. failed-fix escalation: safe first, reset second ------------ */
test("Wi-Fi off: toggle tip fails → network reset auto-recommends → exhausted", () => {
  const s = flow("network", [["net-state", "off"], ["net-when", "random"], ["net-scope", "one"]]);

  const r1 = E.analyze(s);
  assert.equal(r1.recommendedFix, REUSED.slowWifi, "safe toggle tip must come first");

  // All questions already answered → afterFailedFix re-analyzes directly.
  const r2 = E.afterFailedFix(s, REUSED.slowWifi);
  assert.equal(r2.status, "success", `status=${r2.status}`);
  assert.equal(r2.recommendedFix, NEW_SLUGS[0], "medium-risk network reset escalates in after the safe tip failed");
  assert.ok(!r2.alternativeFixes.includes(REUSED.slowWifi), "already-tried toggle tip must not be re-listed");

  // Reset also fails → every cause's fix has been tried → exhausted, no crash.
  const r3 = E.afterFailedFix(s, NEW_SLUGS[0]);
  assert.equal(r3.status, "exhausted", `status=${r3.status}`);
  assert.equal(r3.recommendedFix, null, "exhaustion must not recommend a fix");
});

test("display: display tip fails → NVRAM reset (reused) escalates in", () => {
  const s = flow("hardware", [["hw-mac-what", "display"]]);

  const r1 = E.analyze(s);
  assert.equal(r1.recommendedFix, NEW_SLUGS[2], "new display tip must come first");

  const r2 = E.afterFailedFix(s, NEW_SLUGS[2]);
  assert.equal(r2.status, "success", `status=${r2.status}`);
  assert.equal(r2.recommendedFix, REUSED.nvram, "NVRAM reset (existing tip) escalates in after the display tip failed");

  // NVRAM also fails → engine falls through to remaining profile causes.
  // Neither tried fix may be re-recommended (same semantics as Phase 3.2.2B).
  const r3 = E.afterFailedFix(s, REUSED.nvram);
  assert.ok(["success", "exhausted"].includes(r3.status), `status=${r3.status}`);
  for (const tried of [NEW_SLUGS[2], REUSED.nvram]) {
    assert.notEqual(r3.recommendedFix, tried, `tried fix ${tried} must not be re-recommended`);
    assert.ok(!r3.alternativeFixes.includes(tried), `tried fix ${tried} must not appear as an alternative`);
  }
});

test("audio: single approved cause → after its fix fails the flow is exhausted", () => {
  const s = flow("audio", [["mac-audio-what", "speakers"], ["mac-audio-where", "nothing-works"]]);
  const r1 = E.analyze(s);
  assert.equal(r1.recommendedFix, NEW_SLUGS[1], "output-device tip recommended");

  const r2 = E.afterFailedFix(s, NEW_SLUGS[1]);
  assert.equal(r2.status, "exhausted", `status=${r2.status}`);
  assert.equal(r2.recommendedFix, null, "no second Mac audio fix exists — must not invent one");
});

/* ---------- 5. platform guard: new Mac knowledge stays on Mac ------------- */
test("new Mac fixes never leak into non-Mac profiles or flows", () => {
  const D = E.data;
  const leaks = [];
  for (const p of D.profiles) {
    if (p.devices.includes("mac")) continue;
    for (const c of p.causes || []) {
      if (NEW_SLUGS.includes(c.fix)) leaks.push(`${p.id}/${c.id} → ${c.fix}`);
      for (const a of c.alt || []) if (NEW_SLUGS.includes(a)) leaks.push(`${p.id}/${c.id} alt → ${a}`);
    }
  }
  assert.deepEqual(leaks, [], "new Mac-only fixes leaked into windows/other profiles: " + leaks.join(", "));

  // Structural guard: the new questions are not in any non-Mac profile.
  const foreign = [];
  for (const p of D.profiles) {
    if (p.devices.includes("mac")) continue;
    for (const qid of p.questions || []) {
      if (["mac-audio-what", "mac-audio-where"].includes(qid)) foreign.push(`${p.id} → ${qid}`);
    }
  }
  assert.deepEqual(foreign, [], "new Mac questions leaked into non-Mac profiles: " + foreign.join(", "));

  // Engine-level proof: for EVERY answer in the three touched Mac flows, any
  // recommendation must be a genuine macOS tip (cat === "mac").
  const TIPS = vm.runInThisContext("TIPS");
  const slugCat = new Map(TIPS.map((t) => [String(t.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""), t.cat]));
  for (const category of ["network", "audio", "hardware"]) {
    const prof = D.profiles.find((p) => p.category === category && p.devices.includes("mac"));
    for (const qid of prof.questions) {
      for (const opt of D.questions[qid].options || []) {
        if (!opt.value) continue;
        const s = E.newSession(null);
        E.selectDevice(s, "mac");
        assert.ok(E.selectCategory(s, category).ok, `${category} offered for mac`);
        E.skipDescription(s);
        // Answer the whole flow with this option first (then fill the rest).
        if (!E.answer(s, qid, opt.value).ok) continue; // gated question — covered by test 2
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

  // Reverse direction: the Windows audio flow must never serve the new Mac tip.
  const s = E.newSession(null);
  E.selectDevice(s, "windows"); E.selectCategory(s, "audio"); E.skipDescription(s);
  for (const qid of D.profiles.find((p) => p.id === "win-audio").questions) {
    if (!E.answer(s, qid, D.questions[qid].options[0].value).ok) break;
  }
  const r = E.analyze(s);
  assert.ok(!r.recommendedFix || !NEW_SLUGS.includes(r.recommendedFix),
    `windows audio flow recommended a Mac-only fix: ${r.recommendedFix}`);
});

/* ---------- 6. worker-side approved knowledge ------------------------------ */
test("worker sees the new questions and fixes in its approved set", () => {
  const { firstBranchQuestion, allApprovedQuestions, getFixBySlug } = knowledge;

  // First-branch question per Mac category (what the deterministic router serves).
  assert.equal(firstBranchQuestion("mac", "network").id, "net-state", "router must serve net-state for mac/network");
  assert.equal(firstBranchQuestion("mac", "audio").id, "mac-audio-what", "router must serve mac-audio-what for mac/audio");
  assert.equal(firstBranchQuestion("mac", "hardware").id, "hw-mac-what", "router must serve hw-mac-what for mac/hardware");

  // Every new question id is in the approved bank the worker validates against.
  const approved = allApprovedQuestions();
  const ids = (Array.isArray(approved) ? approved.map((q) => q && q.id).filter(Boolean)
    : Object.keys(approved || {}));
  for (const qid of ["mac-audio-what", "mac-audio-where"]) {
    assert.ok(ids.includes(qid), `worker approved question set missing ${qid}`);
  }

  // Every new fix id resolves in the worker's tip table.
  for (const slug of NEW_SLUGS) {
    const t = getFixBySlug(slug);
    assert.ok(t && typeof t.title === "string", `getFixBySlug("${slug}") must resolve`);
  }
});

/* ---------- 7. data integrity of the new knowledge ------------------------- */
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
  for (const qid of ["mac-audio-what", "mac-audio-where"]) {
    assert.ok(D.questions[qid], `${qid} missing from question bank`);
    const owner = D.profiles.find((p) => (p.questions || []).includes(qid));
    assert.ok(owner, `${qid} not referenced by any profile`);
  }
  // Every new cause is reachable: it has at least one scoring option or keyword.
  for (const cid of ["mac-net-off", "mac-net-dns", "mac-aud-output", "mac-hw-display", "mac-hw-nvram", "mac-hw-bluetooth"]) {
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

test("regression: all pre-Phase-3.2.3 Mac fix ids still resolve", () => {
  const { getFixBySlug } = knowledge;
  const ORIGINAL_MAC_16 = [
    "fix-a-mac-that-won-t-start-up",
    "fix-slow-wi-fi-on-your-mac",
    "force-quit-a-frozen-app",
    "free-up-disk-space-with-storage-management",
    "give-safari-a-proper-clean-out",
    "keep-macos-updated-the-safe-way",
    "keep-your-mac-battery-healthy",
    "open-apps-blocked-by-gatekeeper",
    "reset-nvram-when-things-misbehave",
    "run-first-aid-on-external-drives",
    "set-up-time-machine-properly",
    "speed-up-a-sluggish-macbook",
    "stop-apps-from-launching-at-login",
    "tame-spotlight-indexing-on-extra-drives",
    "turn-on-filevault-full-disk-encryption",
    "keep-10-of-your-disk-free", // shared with Windows, referenced by mac causes
  ];
  const missing = ORIGINAL_MAC_16.filter((s) => !getFixBySlug(s));
  assert.deepEqual(missing, [], "pre-existing Mac fix ids no longer resolve: " + missing.join(", "));

  // Library totals after Phase 3.2.3 (82 baseline + 4 new), then Phase 3.3
  // adds 3 more Mac tips (trackpad/mouse restart pass + two microphone
  // procedures) → 89.
  const TIPS = vm.runInThisContext("TIPS");
  assert.equal(TIPS.length, 89, `expected 89 tips (got ${TIPS.length})`);
  const slugs = TIPS.map((t) => String(t.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
  assert.equal(new Set(slugs).size, slugs.length, "fix ids (slugs) must stay unique");
});
