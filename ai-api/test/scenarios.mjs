/* ============================================================
   EmTech AI — deterministic router scenario tests (Phase 3.1 §50/§51)

   These exercise the RULES side of the hybrid architecture: local
   platform/category classification and knowledge retrieval — the layer
   that decides what context Qwen sees and where the Phase 2 fallback
   engine branches. No network, no model calls: fast and deterministic.

   Model-behavior scenarios (malformed JSON, invalid fix ids, repeated
   questions, unavailable API) are covered by validate.test.mjs against
   the same contract the worker enforces.

   Run from the repo root:
     node --test ai-api/test/scenarios.mjs
   ============================================================ */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/* Load the frontend knowledge modules exactly as the browser does
   (tips-data → diag-data → classification-words → ai-knowledge), with a
   window shim. */
globalThis.window = globalThis;
for (const f of ["tips-data.js", "diag-data.js", "classification-words.js", "ai-knowledge.js"]) {
  vm.runInThisContext(fs.readFileSync(path.join(root, f), "utf8"), { filename: f });
}

const K = globalThis.EmTechAIKnowledge;
assert.ok(K && typeof K.classifyProblem === "function", "knowledge layer loaded");

/* [input, expectedPlatform, expectedCategory] — null means "must stay unknown". */
const CASES = [
  // Spec §50 reference tests
  ["My Windows laptop is suddenly very slow.", "windows", "performance"],        // TEST 001
  ["My MacBook says my startup disk is almost full.", "mac", "storage"],          // TEST 002
  ["My PC won't connect to Wi-Fi.", null, "network"],                             // TEST 003
  ["Fix my computer.", null, null],                                               // TEST 004 → AI must ask

  // Windows branches
  ["my windows pc takes forever to start up in the morning", "windows", "performance"],
  ["windows keeps restarting by itself with a blue screen", "windows", "crashes"],
  ["games stutter and fps drops in windows 11", "windows", "gaming"],
  ["no sound from my windows pc speakers", "windows", "audio"],
  ["windows update stuck at 80 percent for hours", "windows", "updates"],
  ["my windows laptop gets really hot and the fan is loud", "windows", "overheating"],
  ["my windows pc says not enough disk space left", "windows", "storage"],
  ["pop ups everywhere and my antivirus got disabled on windows", "windows", "security"],

  // Mac branches
  ["my imac is slow when i open safari and mail", "mac", "performance"],
  ["macbook battery dies even though it says 40 percent", "mac", "hardware"],
  ["internet drops every few minutes on my mac laptop", "mac", "network"],
  ["my macbook fan runs loud and it gets hot on the bottom", "mac", "overheating"],
  ["macos update keeps failing to install", "mac", "updates"],

  // Platform unknown — AI must ask, never guess (§20)
  ["screen goes black randomly while gaming", null, "crashes"],
  ["keyboard keys stop working sometimes", null, "hardware"],
  ["pop ups everywhere and my antivirus got disabled", null, "security"],

  // Ambiguous / no signal — must NOT produce a confident branch (§8)
  ["something is wrong with it", null, null],
  ["it's broken", null, null],

  // Extra coverage: phrasing variants + tie-breaking (phrase weight > single word)
  ["my macbook air beachballs when i open apps", "mac", "performance"],
  ["wireless keeps disconnecting on my windows 10 laptop", "windows", "network"],
  ["my pc freezes and hangs when i open chrome", null, "performance"],
  ["my mac is running out of space and safari is slow", "mac", "storage"],
  ["blue screen of death on my windows laptop after update", "windows", "crashes"],
  ["my imac won't start up at all", "mac", "crashes"],
  ["games lag and stutter in windows", "windows", "gaming"],
  ["my macbook is slow and the fan is loud", "mac", "overheating"],
  ["virus warning pop up on my windows pc", "windows", "security"],
  ["my macbook trackpad stopped working", "mac", "hardware"],
];

test("classification scenarios (§50/§51): platform + category routing", () => {
  const failures = [];
  for (const [input, wantPlatform, wantCategory] of CASES) {
    const got = K.classifyProblem(input);
    if (got.platform !== wantPlatform || got.category !== wantCategory) {
      failures.push(`"${input}" → got ${JSON.stringify(got)}, wanted platform=${wantPlatform} category=${wantCategory}`);
    }
  }
  assert.equal(failures.length, 0, "mismatches:\n" + failures.join("\n"));
});

test("knowledge retrieval: relevant fixes surface for common problems (§17)", () => {
  const wifi = K.searchKnowledgeBase({ query: "wifi keeps disconnecting", limit: 5 });
  assert.ok(wifi.length > 0, "wifi query should retrieve at least one fix");
  assert.ok(wifi.every((h) => h.slug && typeof h.tip.title === "string"), "hits carry real slugs + tips");

  const slow = K.searchKnowledgeBase({ query: "windows pc very slow", platform: "windows", limit: 5 });
  assert.ok(slow.length > 0, "slow-PC query should retrieve at least one fix");
  assert.ok(!slow.some((h) => h.tip.cat === "mac"), "a windows session must not be served mac-only fixes first");

  const mac = K.searchKnowledgeBase({ query: "macbook slow", platform: "mac", limit: 5 });
  assert.ok(mac.length > 0, "mac query should retrieve at least one fix");
});

test("session-aware retrieval survives short answers (§8/§40)", () => {
  const hits = K.searchForSession({
    summary: "Windows PC is running slowly",
    description: "my laptop has become very slow over the last few days",
    category: "performance",
    topic: "Does it get worse after you've been using it for a while?",
    platform: "windows",
    limit: 6,
  });
  assert.ok(Array.isArray(hits) && hits.length >= 3, "session retrieval must return context even when the latest message is just an answer");
});

test("fix lookup: real slugs resolve, invented ones do not (§19)", () => {
  const first = K.searchKnowledgeBase({ query: "slow", limit: 1 })[0];
  assert.ok(first && first.slug, "library exposes at least one slug");
  assert.equal(K.getFixBySlug(first.slug).title, first.tip.title, "real slug resolves to its tip");
  assert.equal(K.getFixBySlug("totally-invented-fix-xyz"), null, "invented fix ids must resolve to nothing");
});
