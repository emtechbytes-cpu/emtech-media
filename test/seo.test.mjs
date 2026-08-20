/* ============================================================
   EmTech Media — Phase 4: SEO static-site gate (spec §25, 24 checks)

   Independent verification of the generated site. Recomputes every
   expectation from the canonical data sources (tips-data.js and
   diag-data.js) plus the files on disk — it does NOT trust the
   generator's self-reported validation output.

   Run: node --test test/seo.test.mjs
   ============================================================ */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://emtechbytes-cpu.github.io/emtech-media/";

/* Canonical knowledge base — single source of truth (spec §2 RULE 1). */
import tipsModule from "../tips-data.js";
const { TIPS, tipSlug } = tipsModule;
import diagModule from "../diag-data.js";
const DIAG = diagModule;

/* ---------- helpers ---------- */
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const platformOf = (tip) => (tip.cat === "mac" ? "mac" : "windows");
const slugOf = (tip) => tipSlug(tip.title);
const pagePath = (tip) => `${platformOf(tip)}/${slugOf(tip)}/index.html`;

/* All published pages: 89 fix pages + the two hubs. */
const FIX_PAGES = TIPS.map((t) => ({ tip: t, rel: pagePath(t), slug: slugOf(t), platform: platformOf(t) }));
const HUBS = [
  { rel: "windows/index.html", url: BASE + "windows/" },
  { rel: "mac/index.html", url: BASE + "mac/" },
];

/* Every HTML document that is part of the public site (link-scan scope). */
function allSiteHtml() {
  const files = ["index.html", "ai.html", "diagnose.html", "404.html", "windows.html", "mac.html"];
  for (const hub of HUBS) files.push(hub.rel);
  for (const p of FIX_PAGES) files.push(p.rel);
  return files;
}

/* Extract a single attribute value from the first matching tag. */
function attr(html, re) {
  const m = html.match(re);
  return m ? m[1] : null;
}
const titleOf = (html) => attr(html, /<title>([\s\S]*?)<\/title>/i);
const descOf = (html) => attr(html, /<meta name="description" content="([^"]*)"/i);
const canonicalOf = (html) => attr(html, /<link rel="canonical" href="([^"]+)"/i);

/* Decode the five standard HTML entities so length checks measure what a
   crawler actually reads (the decoded text), not the escaped raw attribute. */
function decodeEntities(s) {
  return String(s)
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/* Resolve a possibly-relative URL from the directory of `fromRel`. */
function resolveHref(fromRel, href) {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean) return null; // pure anchor — nothing to verify on disk
  if (/^(https?:)?\/\//i.test(href)) return null; // external / protocol-relative
  if (/^(data:|mailto:|tel:)/i.test(href)) return null;
  const dir = path.posix.dirname(fromRel);
  let p = path.posix.normalize(path.posix.join(dir, clean));
  if (p.endsWith("/")) p += "index.html";
  return p;
}

/* All href/src targets in an HTML document. */
function linkTargets(html) {
  const out = [];
  const re = /\b(?:href|src)="([^"]+)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

/* ---------- shared precomputed state (fail fast, once) ---------- */
const fixHtml = new Map(); // rel -> raw html
for (const p of FIX_PAGES) {
  assert.ok(exists(p.rel), `missing generated page: ${p.rel}`);
  fixHtml.set(p.rel, read(p.rel));
}

/* ============================================================
   1–2. Unique URLs + unique slugs
   ============================================================ */
test("all 89 tips have unique permanent slugs", () => {
  assert.equal(TIPS.length, 89, `expected 89 canonical tips, got ${TIPS.length}`);
  const slugs = TIPS.map(slugOf);
  assert.equal(new Set(slugs).size, 89, "duplicate fix slug detected");
});

test("every published page has a unique URL (canonical)", () => {
  const urls = new Map();
  for (const p of FIX_PAGES) {
    const c = canonicalOf(fixHtml.get(p.rel));
    assert.ok(c, `${p.rel}: no canonical`);
    if (urls.has(c)) throw new Error(`duplicate canonical ${c} (${urls.get(c)} and ${p.rel})`);
    urls.set(c, p.rel);
  }
  for (const hub of HUBS) {
    const c = canonicalOf(read(hub.rel));
    assert.ok(!urls.has(c), `hub ${hub.rel} shares a canonical with a fix page: ${c}`);
  }
});

/* ============================================================
   3–4. Unique titles + unique descriptions (published pages)
   ============================================================ */
test("every published page has a unique <title>", () => {
  const seen = new Map();
  for (const p of FIX_PAGES) {
    const t = titleOf(fixHtml.get(p.rel));
    assert.ok(t, `${p.rel}: no <title>`);
    if (seen.has(t)) throw new Error(`duplicate title "${t}" (${seen.get(t)} and ${p.rel})`);
    seen.set(t, p.rel);
  }
  for (const hub of HUBS) {
    const t = titleOf(read(hub.rel));
    assert.ok(!seen.has(t), `hub ${hub.rel} shares a title with a fix page: "${t}"`);
  }
});

test("every published page has a unique meta description", () => {
  const seen = new Map();
  for (const p of FIX_PAGES) {
    const d = descOf(fixHtml.get(p.rel));
    assert.ok(d, `${p.rel}: no meta description`);
    if (seen.has(d)) throw new Error(`duplicate description on ${seen.get(d)} and ${p.rel}`);
    seen.set(d, p.rel);
  }
  for (const hub of HUBS) {
    const d = descOf(read(hub.rel));
    assert.ok(!seen.has(d), `hub ${hub.rel} shares a description with a fix page`);
  }
});

/* ============================================================
   5. Exactly one H1 per published page
   ============================================================ */
test("exactly one <h1> on every published page", () => {
  const pages = [...FIX_PAGES.map((p) => [p.rel, fixHtml.get(p.rel)]), ...HUBS.map((h) => [h.rel, read(h.rel)])];
  for (const [rel, html] of pages) {
    const count = (html.match(/<h1[\s>]/gi) || []).length;
    assert.equal(count, 1, `${rel}: expected exactly one <h1>, found ${count}`);
  }
});

/* ============================================================
   6–7. Canonical exists + matches the expected URL
   ============================================================ */
test("canonical link present and matching the expected URL on every fix page", () => {
  for (const p of FIX_PAGES) {
    const c = canonicalOf(fixHtml.get(p.rel));
    assert.equal(c, BASE + `${p.platform}/${p.slug}/`, `${p.rel}: canonical ${c} does not match expected`);
  }
});

test("canonical link present and matching on both hubs", () => {
  for (const hub of HUBS) {
    const c = canonicalOf(read(hub.rel));
    assert.equal(c, hub.url, `${hub.rel}: canonical ${c} does not match expected`);
  }
});

/* ============================================================
   8–9. Title + description length sanity
   ============================================================ */
test("titles are a reasonable length (≤70 chars as decoded)", () => {
  for (const p of FIX_PAGES) {
    const t = decodeEntities(titleOf(fixHtml.get(p.rel)));
    assert.ok(t.length <= 70, `${p.rel}: title too long (${t.length}): ${t}`);
  }
});

test("meta descriptions are a reasonable length (≤160 chars as decoded)", () => {
  for (const p of FIX_PAGES) {
    const d = decodeEntities(descOf(fixHtml.get(p.rel)));
    assert.ok(d.length <= 160, `${p.rel}: description too long (${d.length})`);
  }
});

/* ============================================================
   10–11. Real step content in the initial HTML (no-JS proof)
   ============================================================ */
test("every fix page contains its full step list in raw HTML", () => {
  for (const p of FIX_PAGES) {
    const html = fixHtml.get(p.rel);
    const ol = html.match(/<ol class="tip-steps fix-steps">([\s\S]*?)<\/ol>/);
    assert.ok(ol, `${p.rel}: missing static <ol> steps`);
    const lis = (ol[1].match(/<li>/g) || []).length;
    assert.equal(lis, p.tip.steps.length, `${p.rel}: expected ${p.tip.steps.length} step items in raw HTML, found ${lis}`);
  }
});

test("every fix page is fully readable without JavaScript", () => {
  for (const p of FIX_PAGES) {
    const html = fixHtml.get(p.rel);
    assert.ok(/<h1[\s>]/.test(html), `${p.rel}: no H1 in raw HTML`);
    assert.ok(html.includes('class="fix-summary"'), `${p.rel}: missing summary section`);
    assert.ok(html.includes("<h2>Before you start</h2>"), `${p.rel}: missing safety section`);
    assert.ok(html.includes("<h2>Steps</h2>"), `${p.rel}: missing steps heading`);
    assert.ok(html.includes("<h2>How to verify the fix</h2>"), `${p.rel}: missing verification section`);
    assert.ok(html.includes("<h2>If this didn't fix it</h2>"), `${p.rel}: missing failure-condition section`);
  }
});

/* ============================================================
   12. Related links resolve on disk
   ============================================================ */
test("every related-fix link resolves to a real page", () => {
  for (const p of FIX_PAGES) {
    const html = fixHtml.get(p.rel);
    const relSection = html.match(/<section class="fix-related"[\s\S]*?<\/section>/);
    assert.ok(relSection, `${p.rel}: missing related-fixes section`);
    const hrefs = [...relSection[0].matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(hrefs.length >= 2 && hrefs.length <= 4, `${p.rel}: expected 2–4 related links, found ${hrefs.length}`);
    for (const h of hrefs) {
      const target = resolveHref(p.rel, h);
      assert.ok(target && exists(target), `${p.rel}: broken related link "${h}"`);
    }
  }
});

/* ============================================================
   13. Breadcrumbs resolve (visible nav + JSON-LD)
   ============================================================ */
test("breadcrumbs on every fix page resolve to real pages", () => {
  for (const p of FIX_PAGES) {
    const html = fixHtml.get(p.rel);
    const crumb = html.match(/<nav class="breadcrumbs"[\s\S]*?<\/nav>/);
    assert.ok(crumb, `${p.rel}: missing visible breadcrumb`);
    const hrefs = [...crumb[0].matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(hrefs.length, 2, `${p.rel}: expected Home + hub in breadcrumb, found ${hrefs.length} links`);
    for (const h of hrefs) {
      const target = resolveHref(p.rel, h);
      assert.ok(target && exists(target), `${p.rel}: broken breadcrumb link "${h}"`);
    }
    /* JSON-LD BreadcrumbList must exist and match the visible trail. */
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(ld, `${p.rel}: missing BreadcrumbList JSON-LD`);
    const data = JSON.parse(ld[1]);
    assert.equal(data["@type"], "BreadcrumbList", `${p.rel}: JSON-LD is not a BreadcrumbList`);
    assert.equal(data.itemListElement.length, 3, `${p.rel}: breadcrumb trail should have 3 items`);
    for (const item of data.itemListElement) {
      const afterBase = new URL(item.item).href.slice(BASE.length);
      const target = afterBase.endsWith("/") ? afterBase + "index.html" : afterBase;
      assert.ok(exists(target), `${p.rel}: JSON-LD breadcrumb points at missing page "${item.item}"`);
    }
  }
});

/* ============================================================
   14–16. Sitemap: complete, clean, canonical
   ============================================================ */
const sitemap = read("sitemap.xml");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

test("sitemap contains every published page", () => {
  const set = new Set(sitemapUrls);
  for (const p of FIX_PAGES) assert.ok(set.has(BASE + `${p.platform}/${p.slug}/`), `sitemap missing ${p.rel}`);
  assert.ok(set.has(BASE + "windows/"), "sitemap missing Windows hub");
  assert.ok(set.has(BASE + "mac/"), "sitemap missing Mac hub");
  assert.ok(set.has(BASE + "index.html"), "sitemap missing homepage");
});

test("sitemap contains no review pages, stubs or duplicates", () => {
  const fixUrls = sitemapUrls.filter((u) => /\/(windows|mac)\/[^/]+\/$/.test(u));
  assert.equal(fixUrls.length, 89, `expected exactly 89 fix URLs in sitemap, found ${fixUrls.length}`);
  for (const bad of ["windows.html", "mac.html"]) {
    assert.ok(!sitemapUrls.some((u) => u.endsWith(bad)), `sitemap must not list the migration stub ${bad}`);
  }
  assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, "duplicate URLs in sitemap");
});

test("every sitemap URL is absolute and canonical", () => {
  for (const u of sitemapUrls) {
    assert.ok(u.startsWith(BASE), `sitemap URL not on the live host: ${u}`);
    const afterBase = u.slice(BASE.length);
    const target = afterBase.endsWith("/") ? afterBase + "index.html" : afterBase;
    assert.ok(exists(target), `sitemap points at missing file: ${u}`);
  }
});

/* ============================================================
   17. robots.txt references the sitemap
   ============================================================ */
test("robots.txt allows crawling and references the sitemap", () => {
  const robots = read("robots.txt");
  assert.ok(/User-agent:\s*\*/m.test(robots), "missing User-agent: *");
  assert.ok(!/Disallow:/i.test(robots), "unexpected Disallow rule in robots.txt");
  assert.ok(robots.includes(`Sitemap: ${BASE}sitemap.xml`), "robots.txt does not reference the sitemap URL");
});

/* ============================================================
   18. No broken internal links anywhere on the public site
   ============================================================ */
test("no broken internal links across the whole public site", () => {
  const broken = [];
  for (const rel of allSiteHtml()) {
    const html = read(rel);
    for (const h of linkTargets(html)) {
      const target = resolveHref(rel, h);
      if (target && !exists(target)) broken.push(`${rel} → ${h}`);
    }
  }
  assert.deepEqual(broken, [], "broken internal links:\n" + broken.join("\n"));
});

/* ============================================================
   19. No duplicate canonical URLs site-wide
   ============================================================ */
test("no two public pages share a canonical URL", () => {
  const seen = new Map();
  for (const rel of allSiteHtml()) {
    const c = canonicalOf(read(rel));
    if (!c) continue; // stubs intentionally carry no canonical
    if (seen.has(c)) throw new Error(`duplicate canonical ${c}: ${seen.get(c)} and ${rel}`);
    seen.set(c, rel);
  }
});

/* ============================================================
   20. No orphaned published fix pages (each linked from its hub)
   ============================================================ */
test("every published fix is linked from its platform hub", () => {
  const winHub = read("windows/index.html");
  const macHub = read("mac/index.html");
  for (const p of FIX_PAGES) {
    const hub = p.platform === "mac" ? macHub : winHub;
    assert.ok(hub.includes(`href="${p.slug}/"`), `${p.rel}: not linked from the ${p.platform} hub`);
  }
});

/* ============================================================
   21. Platform guard: mac tips only under /mac/, windows-side only under /windows/
   ============================================================ */
test("platform guard holds in the generated directory layout", () => {
  for (const p of FIX_PAGES) {
    assert.equal(p.platform, p.tip.cat === "mac" ? "mac" : "windows");
    const html = fixHtml.get(p.rel);
    if (p.platform === "mac") {
      assert.ok(html.includes(BASE + "mac/"), `${p.rel}: mac page missing hub link`);
    } else {
      assert.ok(!html.includes(`href="../../mac/${p.slug}/"`), `${p.rel}: windows page links to its own mac path`);
    }
  }
  /* Cross-check: no mac slug directory under windows/ and vice versa. */
  const winSlugs = new Set(TIPS.filter((t) => t.cat !== "mac").map(slugOf));
  const macSlugs = new Set(TIPS.filter((t) => t.cat === "mac").map(slugOf));
  for (const s of macSlugs) assert.ok(!exists(`windows/${s}/index.html`), `mac tip "${s}" leaked into windows/`);
  for (const s of winSlugs) assert.ok(!exists(`mac/${s}/index.html`), `windows tip "${s}" leaked into mac/`);
});

/* ============================================================
   22. All existing fix slugs remain resolvable on disk
   ============================================================ */
test("all 89 canonical fix slugs resolve to a published page", () => {
  for (const p of FIX_PAGES) assert.ok(exists(p.rel), `slug ${p.slug} has no published page`);
});

/* ============================================================
   23. Safety metadata rendered in the initial HTML
   ============================================================ */
test("every fix page renders risk, reversibility, verification and failure conditions", () => {
  for (const p of FIX_PAGES) {
    const html = fixHtml.get(p.rel);
    const riskLabel = p.tip.risk_level[0].toUpperCase() + p.tip.risk_level.slice(1);
    assert.ok(html.includes(`<strong>${riskLabel} risk.</strong>`), `${p.rel}: missing "${riskLabel} risk" label`);
    if (p.tip.reversible === true) {
      assert.ok(html.includes("This change is reversible"), `${p.rel}: missing reversibility statement`);
    } else {
      assert.ok(html.includes("not fully reversible"), `${p.rel}: missing non-reversibility warning`);
    }
    const verify = html.match(/<h2>How to verify the fix<\/h2>\s*<p>([\s\S]*?)<\/p>/);
    assert.ok(verify && verify[1].trim().length > 0, `${p.rel}: verification section empty`);
    const failure = html.match(/<h2>If this didn't fix it<\/h2>\s*<p>([\s\S]*?)<\/p>/);
    assert.ok(failure && failure[1].trim().length > 0, `${p.rel}: failure-condition section empty`);
  }
});

/* ============================================================
   24. Diagnostic engine fix IDs still resolve to published pages
   ============================================================ */
test("every cause→fix reference in the diagnostic data resolves to a live page", () => {
  const bySlug = new Map(TIPS.map((t) => [slugOf(t), t]));
  let refs = 0;
  const broken = [];
  for (const profile of DIAG.profiles) {
    for (const cause of profile.causes || []) {
      if (cause.fix) {
        refs += 1;
        const tip = bySlug.get(cause.fix);
        if (!tip) broken.push(`${profile.id}/${cause.id} → ${cause.fix}`);
        else if (!exists(pagePath(tip))) broken.push(`${profile.id}/${cause.id} → ${cause.fix} (no published page)`);
      }
      for (const alt of cause.alt || []) {
        refs += 1;
        const tip = bySlug.get(alt);
        if (!tip) broken.push(`${profile.id}/${cause.id} alt → ${alt}`);
        else if (!exists(pagePath(tip))) broken.push(`${profile.id}/${cause.id} alt → ${alt} (no published page)`);
      }
    }
  }
  assert.equal(refs, 147, `expected the Phase 3.3 baseline of 147 cause→fix references, got ${refs}`);
  assert.deepEqual(broken, [], "broken engine fix references:\n" + broken.join("\n"));
});

/* ============================================================
   Supporting artifacts: URL manifest + content audit (spec §24/§31)
   ============================================================ */
test("docs/SEO-URL-MAP.json is the complete permanent slug→URL record", () => {
  const map = JSON.parse(read("docs/SEO-URL-MAP.json"));
  assert.equal(Object.keys(map).length, 89, `expected 89 entries in URL manifest, got ${Object.keys(map).length}`);
  for (const p of FIX_PAGES) {
    const entry = map[p.slug];
    assert.ok(entry, `URL manifest missing slug ${p.slug}`);
    assert.equal(entry.newUrl, BASE + `${p.platform}/${p.slug}/`, `manifest URL mismatch for ${p.slug}`);
    assert.equal(entry.platform, p.platform === "mac" ? "mac" : "windows", `manifest platform mismatch for ${p.slug}`);
  }
});

test("docs/SEO-CONTENT-AUDIT.md classifies every fix PUBLISH/REVIEW/MERGE", () => {
  const audit = read("docs/SEO-CONTENT-AUDIT.md");
  for (const p of FIX_PAGES) assert.ok(audit.includes(p.slug), `content audit missing slug ${p.slug}`);
  for (const word of ["PUBLISH", "REVIEW", "MERGE"]) assert.ok(audit.includes(word), `audit report missing classification "${word}"`);
});

test("404 page exists and links home + both hubs without JavaScript", () => {
  const html = read("404.html");
  assert.ok(/<h1[\s>]/.test(html), "404 page has no H1");
  assert.ok(html.includes('href="index.html"'), "404 page missing home link");
  assert.ok(html.includes('href="windows/"'), "404 page missing Windows hub link");
  assert.ok(html.includes('href="mac/"'), "404 page missing Mac hub link");
});

test("published pages are indexable (no noindex on any sitemap URL)", () => {
  for (const p of FIX_PAGES) {
    assert.ok(!/name="robots"[^>]*noindex/i.test(fixHtml.get(p.rel)), `${p.rel}: published page is noindexed`);
  }
  for (const hub of HUBS) {
    assert.ok(!/name="robots"[^>]*noindex/i.test(read(hub.rel)), `${hub.rel}: hub is noindexed`);
  }
});
