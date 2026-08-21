/* ============================================================
   EmTech Media — Phase 5: SEO content-quality gate

   Independent verification of the Phase 5 deliverables and the
   invariants they depend on. Recomputes every expectation from the
   canonical data source (tips-data.js) plus the files on disk — it
   does NOT trust the audit builder's self-reported output.

   Run: node --test test/phase5.test.mjs
   ============================================================ */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://emtechbytes-cpu.github.io/emtech-media/";

/* Canonical knowledge base — single source of truth (RULE 1). */
import tipsModule from "../tips-data.js";
const { TIPS, tipSlug } = tipsModule;

/* ---------- helpers ---------- */
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const platformOf = (tip) => (tip.cat === "mac" ? "mac" : "windows");
const slugOf = (tip) => tipSlug(tip.title);
const pagePath = (tip) => `${platformOf(tip)}/${slugOf(tip)}/index.html`;

const FIX_PAGES = TIPS.map((t) => ({ tip: t, rel: pagePath(t), slug: slugOf(t), platform: platformOf(t) }));
const BY_SLUG = new Map(FIX_PAGES.map((p) => [p.slug, p]));

function allSiteHtml() {
  const files = ["index.html", "ai.html", "diagnose.html", "404.html", "windows.html", "mac.html"];
  files.push("windows/index.html", "mac/index.html");
  for (const p of FIX_PAGES) files.push(p.rel);
  return files;
}

/* ---------- audit artifacts ---------- */
test("Phase 5 audit artifacts exist and are well-formed", () => {
  assert.ok(exists("docs/PHASE-5-SEO-AUDIT.md"), "docs/PHASE-5-SEO-AUDIT.md missing");
  assert.ok(exists("docs/PHASE-5-SEO-AUDIT.json"), "docs/PHASE-5-SEO-AUDIT.json missing");
  const j = JSON.parse(read("docs/PHASE-5-SEO-AUDIT.json"));
  assert.equal(j.counts.total, TIPS.length);
  assert.equal(j.counts.windows, FIX_PAGES.filter((p) => p.platform === "windows").length);
  assert.equal(j.counts.mac, FIX_PAGES.filter((p) => p.platform === "mac").length);
  assert.ok(Array.isArray(j.fixes) && j.fixes.length === TIPS.length);
});

const REQUIRED_FIELDS = [
  "platform", "slug", "canonicalUrl", "title", "metaDescription", "h1", "category",
  "difficulty", "timeEstimate", "stepsCount", "articleWordCount", "stepWordCount",
  "safetyMetadata", "relatedFixes", "linkedFromHub", "inSitemap", "canonicalMatchesUrl",
  "titleUnique", "metaDescriptionUnique", "h1Count", "breadcrumbsVisible",
  "breadcrumbJsonLdValid", "likelySearchIntent", "intentType", "targetQuery",
  "qualityScore", "classification", "recommendedAction",
];

test("audit covers every canonical fix exactly once, with all required fields", () => {
  const j = JSON.parse(read("docs/PHASE-5-SEO-AUDIT.json"));
  const slugs = new Set(j.fixes.map((f) => f.slug));
  assert.equal(slugs.size, TIPS.length, "duplicate or missing slug in audit");
  for (const t of TIPS) assert.ok(slugs.has(slugOf(t)), `audit missing tip ${slugOf(t)}`);
  for (const f of j.fixes) {
    for (const k of REQUIRED_FIELDS) assert.ok(k in f, `${f.slug}: missing field "${k}"`);
    const sm = f.safetyMetadata;
    for (const k of ["riskLevel", "reversible", "beforeYouStartSection", "verificationSection", "failureConditionsSection"]) {
      assert.ok(k in sm, `${f.slug}: safetyMetadata.${k} missing`);
    }
  }
});

test("audit classifications are valid and consistent between JSON and MD report", () => {
  const j = JSON.parse(read("docs/PHASE-5-SEO-AUDIT.json"));
  const VALID = new Set(["STRONG", "NEEDS_ENRICHMENT", "REVIEW"]);
  for (const f of j.fixes) assert.ok(VALID.has(f.classification), `${f.slug}: bad classification ${f.classification}`);
  const md = read("docs/PHASE-5-SEO-AUDIT.md");
  const countOf = (cls) => j.fixes.filter((f) => f.classification === cls).length;
  for (const cls of ["STRONG", "NEEDS_ENRICHMENT", "REVIEW"]) {
    assert.ok(md.includes(`| ${cls} | ${countOf(cls)} |`), `MD summary row for ${cls} missing or inconsistent`);
  }
  const rows = md.split("\n").filter((l) => l.startsWith("| `") && l.includes("**STRONG**") || (l.startsWith("| `") && /NEEDS_ENRICHMENT|REVIEW/.test(l) && /\| \d+ \| \*\*/.test(l)));
  assert.equal(rows.length, TIPS.length, "MD per-fix table row count mismatch");
});

/* ---------- curated related fixes ---------- */
test("every curated related slug resolves to a same-platform tip (no self-links)", () => {
  let curated = 0;
  for (const t of TIPS) {
    if (!Array.isArray(t.related)) continue;
    curated++;
    assert.ok(t.related.length >= 2, `${slugOf(t)}: curated related list must have ≥2 entries to be used`);
    for (const s of t.related) {
      const target = BY_SLUG.get(s);
      assert.ok(target, `${slugOf(t)}: unresolvable related slug "${s}"`);
      assert.notEqual(target.slug, slugOf(t), `${slugOf(t)}: self-link in related list`);
      assert.equal(platformOf(target.tip), platformOf(t), `${slugOf(t)}: cross-platform related link to ${s}`);
    }
  }
  assert.ok(curated >= 20, `expected a meaningful curated set, got ${curated}`);
});

test("every rendered fix page shows its curated related links (and 2–4 total)", () => {
  for (const p of FIX_PAGES) {
    const html = read(p.rel);
    const relBlock = (html.match(/<ul class="rel-list">([\s\S]*?)<\/ul>/) || [])[1] || "";
    const links = [...relBlock.matchAll(/href="\.\.\/\.\.\/(?:windows|mac)\/([^/]+)\/"/g)].map((m) => m[1]);
    assert.ok(links.length >= 2 && links.length <= 4, `${p.slug}: related link count ${links.length} outside 2–4`);
    if (Array.isArray(p.tip.related)) {
      for (const s of p.tip.related) assert.ok(links.includes(s), `${p.slug}: curated related "${s}" not rendered`);
    }
  }
});

test("generator and runtime share the curation rule", () => {
  const gen = read("build/generate.mjs");
  const script = read("script.js");
  assert.ok(gen.includes("resolveRelated") && gen.includes("t.related"), "generate.mjs must prefer curated related slugs");
  assert.ok(script.includes("Array.isArray(t.related)"), "script.js relatedTips() must prefer curated related slugs");
});

/* ---------- public-facing counts (RULE 12) ---------- */
test("public-facing fix counts are current and no stale counts remain", () => {
  const home = read("index.html");
  const winHub = read("windows/index.html");
  const macStub = read("mac.html");
  assert.ok(home.includes("89 tested fixes"), "homepage must state the current total (89)");
  assert.ok(winHub.includes("66 tested fixes"), "Windows hub must state 66");
  assert.ok(macStub.includes("23 Mac fixes"), "mac.html stub must state 23");
  const STALE = ["58 tested fixes", "74 tested fixes", "82 tested fixes", "16 tested macOS fixes"];
  for (const file of allSiteHtml()) {
    const html = read(file);
    for (const s of STALE) assert.ok(!html.includes(s), `${file} contains stale count string "${s}"`);
  }
});

/* Every [data-tip-count] carries an inline number as its no-JS fallback. JS
   overwrites it, so a stale one is invisible in a browser and wrong for exactly
   the audience the fallback exists for — crawlers and no-JS visitors. (The Mac
   fallback on the homepage read 16 against a library of 23.) */
test("every [data-tip-count] fallback matches the library", () => {
  const win = TIPS.filter((t) => t.cat !== "mac");
  const mac = TIPS.filter((t) => t.cat === "mac");
  const EXPECTED = {
    all: TIPS.length,
    win: win.length,
    mac: mac.length,
    "win-cats": new Set(win.map((t) => t.cat)).size,
    "mac-groups": new Set(mac.map((t) => t.group).filter(Boolean)).size,
  };

  let checked = 0;
  for (const file of allSiteHtml()) {
    const html = read(file);
    for (const m of html.matchAll(/<[a-z]+[^>]*data-tip-count="([a-z-]+)"[^>]*>([^<]*)</g)) {
      const [, key, raw] = m;
      const want = EXPECTED[key];
      assert.ok(want !== undefined, `${file}: unknown data-tip-count key "${key}"`);

      // Counters start at 0 and animate up to data-count — not a stale fallback.
      if (/data-count=/.test(m[0])) continue;
      assert.equal(
        raw.trim(), String(want),
        `${file}: data-tip-count="${key}" fallback reads ${raw.trim()}, library says ${want}`
      );
      checked++;
    }
  }
  assert.ok(checked > 0, "no [data-tip-count] fallbacks found to check");
});

/* ---------- Phase 4.1 contract: production-safe 404 references ---------- */
test("404.html keeps the Phase 4.1 deep-path navigation contract", () => {
  const nf = read("404.html");
  const refs = [...nf.matchAll(/(?:href|src)="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 3, "404 page should carry navigation references");
  for (const v of refs) {
    const safe = /^https?:\/\//.test(v) || v.startsWith("#") || v === "/" || v.startsWith("/emtech-media/");
    assert.ok(safe, `404.html has a non-production-safe reference "${v}"`);
  }
});

/* ---------- structured data discipline (RULE 15 / Phase 4 spec §12) ---------- */
test("no HowTo schema anywhere; BreadcrumbList present on every fix page", () => {
  for (const file of allSiteHtml()) {
    const html = read(file);
    assert.ok(!/"@type"\s*:\s*"HowTo"/.test(html), `${file} contains HowTo structured data`);
  }
  for (const p of FIX_PAGES) {
    const html = read(p.rel);
    let found = false;
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { if (JSON.parse(m[1])["@type"] === "BreadcrumbList") found = true; } catch {}
    }
    assert.ok(found, `${p.slug}: BreadcrumbList JSON-LD missing`);
  }
});

/* The fix page numbers steps with a CSS counter (.tip-steps li::before), so a
   step that also carries its own "1. " renders as "01. 1. Task Manager …".
   That shipped on one fix; this stops it coming back. */
test("steps do not carry their own numbering", () => {
  for (const p of FIX_PAGES) {
    p.tip.steps.forEach((step, i) => {
      assert.ok(!/^\s*\d+\s*[.)]\s/.test(step),
        `${p.slug}: step ${i + 1} starts with its own number — the page numbers steps already`);
    });
  }
});

/* ---------- gotchas: optional field, but it must be honest where it appears ---------- */
test("every gotchas entry is rendered, escaped and non-trivial", () => {
  const withGotchas = FIX_PAGES.filter((p) => p.tip.gotchas);
  assert.ok(withGotchas.length > 0, "no fix defines gotchas — did the field get dropped?");

  for (const p of FIX_PAGES) {
    const html = read(p.rel);
    const hasSection = html.includes('class="fix-gotchas"');

    // The section appears if and only if the library defines the field. Most
    // fixes should not have one — the short step list is the product.
    assert.equal(hasSection, !!p.tip.gotchas,
      `${p.slug}: gotchas section ${hasSection ? "rendered without" : "missing despite"} data`);
    if (!p.tip.gotchas) continue;

    const block = html.match(/<ul class="gotcha-list">([\s\S]*?)<\/ul>/);
    assert.ok(block, `${p.slug}: gotcha-list markup missing`);
    const items = block[1].match(/<li>/g) || [];
    assert.equal(items.length, p.tip.gotchas.length,
      `${p.slug}: rendered ${items.length} gotchas, library has ${p.tip.gotchas.length}`);

    for (const g of p.tip.gotchas) {
      assert.ok(g.length >= 20, `${p.slug}: gotcha too short to be useful: "${g}"`);
      // Rendered escaped — these strings carry apostrophes, < and & routinely.
      const escaped = g.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                       .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
      assert.ok(block[1].includes(escaped), `${p.slug}: gotcha not rendered verbatim: "${g.slice(0, 40)}..."`);
    }
  }
});

/* A fix must not tell you to destroy the thing its own recovery path needs.
   "Move your OS or games to an SSD" used to say to wipe the old drive right
   after cloning, while its failure_conditions said to boot from it again. */
test("irreversible fixes do not instruct destroying their own rollback", () => {
  for (const p of FIX_PAGES) {
    const t = p.tip;
    if (t.reversible && t.risk_level !== "high") continue;
    const steps = t.steps.join(" ").toLowerCase();
    const destroys = /\b(shred|wipe|erase|format|reuse)\b/.test(steps);
    if (!destroys) continue;
    const guarded = /(month|keep|intact|leave|before you|until)/.test(steps);
    assert.ok(guarded,
      `${p.slug}: a high-risk/irreversible fix tells the reader to destroy the old state ` +
      `with no instruction to keep it first — its failure path depends on that state`);
  }
});

/* ---------- TechArticle freshness signals ---------- */
test("every fix page carries a TechArticle node with a truthful dateModified", () => {
  for (const p of FIX_PAGES) {
    const html = read(p.rel);
    let article = null;
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try {
        const o = JSON.parse(m[1]);
        if (o["@type"] === "TechArticle") article = o;
      } catch {}
    }
    assert.ok(article, `${p.slug}: TechArticle JSON-LD missing`);
    assert.equal(article.headline, p.tip.title, `${p.slug}: headline does not match the library title`);

    // The date must come from the library, not from build time — a generated
    // "today" would claim freshness the content does not have.
    assert.equal(article.dateModified, p.tip.updated, `${p.slug}: dateModified does not match tips-data updated`);

    // tips-data.js records only `updated`, so datePublished may not be invented.
    if (!p.tip.published) {
      assert.ok(!("datePublished" in article), `${p.slug}: datePublished emitted without a published date in the library`);
    }

    // The visible line and the markup have to agree.
    assert.ok(
      html.includes(`<time datetime="${p.tip.updated}">`),
      `${p.slug}: no visible <time> matching dateModified`
    );
  }
});

/* ---------- canonical URL discipline ---------- */
test("audit canonical URLs are absolute, trailing-slash, unique and platform-correct", () => {
  const j = JSON.parse(read("docs/PHASE-5-SEO-AUDIT.json"));
  const urls = new Set();
  for (const f of j.fixes) {
    assert.ok(f.canonicalUrl.startsWith(BASE + f.platform + "/"), `${f.slug}: canonical not under its platform hub`);
    assert.ok(f.canonicalUrl.endsWith("/"), `${f.slug}: canonical must be trailing-slash`);
    assert.ok(!urls.has(f.canonicalUrl), `duplicate canonical ${f.canonicalUrl}`);
    urls.add(f.canonicalUrl);
  }
  assert.equal(urls.size, TIPS.length);
});
