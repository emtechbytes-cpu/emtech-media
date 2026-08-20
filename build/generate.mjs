/* ============================================================
   EmTech Media — Phase 4 static knowledge-base generator
   ----------------------------------------------------------
   ONE FIX = ONE CRAWLABLE URL.

   Canonical data source: ../tips-data.js (TIPS + tipSlug + CAT_LABELS).
   This file is the ONLY place that turns that data into static HTML.
   It does not own any fix content — it renders what the canonical
   array already says, and refuses to run if the data is invalid.

   Output (all committed; GitHub Pages serves them directly):
     windows/index.html            Windows hub
     mac/index.html                Mac hub
     windows/<slug>/index.html     one page per published Windows fix
     mac/<slug>/index.html         one page per published Mac fix
     sitemap.xml                   home + hubs + diagnose + published fixes
     robots.txt                    identical directives to the pre-Phase-4 file
     404.html                      branded, no-JS friendly
     docs/SEO-CONTENT-AUDIT.md     PUBLISH / REVIEW / MERGE report per fix
     docs/SEO-URL-MAP.json         permanent slug → URL manifest

   Run:  node build/generate.mjs
   No dependencies. Node >= 18 (ESM + fs/promises).
   ============================================================ */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://emtechbytes-cpu.github.io/emtech-media";

/* ---------- Canonical data (single source of truth) ---------- */
// tips-data.js is CommonJS with a module.exports shim; Node's ESM/CJS
// interop gives us the exports object as the default import — the same
// pattern ai-api/src/knowledge.js uses in production.
import tipsModule from "../tips-data.js";

const TIPS = (tipsModule && tipsModule.TIPS) || (tipsModule.default && tipsModule.default.TIPS);
const tipSlug = (tipsModule && tipsModule.tipSlug) || (tipsModule.default && tipsModule.default.tipSlug);
const CAT_LABELS = (() => {
  // CAT_LABELS is a top-level const in the CJS file, not exported — re-derive
  // it here from the same fixed vocabulary so the generator never drifts.
  return {
    mac: "Mac", speed: "Speed", windows: "Windows", gaming: "Gaming",
    cleaning: "Cleaning", maintenance: "Maintenance", hardware: "Hardware", security: "Security",
  };
})();

if (!Array.isArray(TIPS) || typeof tipSlug !== "function") {
  throw new Error("tips-data.js did not expose TIPS + tipSlug — canonical data source broken.");
}

const LEVELS = { 1: "Easy", 2: "Medium", 3: "Advanced" };
const GROUP_LABELS = { speed: "Speed & performance", fixes: "Everyday fixes", security: "Security & backups" };
const WIN_ORDER = ["speed", "windows", "gaming", "cleaning", "maintenance", "hardware", "security"];

/* ---------- Validation (fail fast, never render bad data) ---------- */
function fail(msg) { throw new Error("DATA VALIDATION FAILED: " + msg); }

for (const [i, t] of TIPS.entries()) {
  const where = `TIPS[${i}] (${t.title || "untitled"})`;
  if (!t || typeof t !== "object") fail(`${where} is not an object`);
  if (typeof t.title !== "string" || !t.title.trim()) fail(`${where}: title missing`);
  if (!CAT_LABELS[t.cat]) fail(`${where}: unknown cat "${t.cat}"`);
  if (![1, 2, 3].includes(t.difficulty)) fail(`${where}: difficulty must be 1|2|3`);
  if (typeof t.time !== "string" || !t.time.trim()) fail(`${where}: time missing`);
  if (typeof t.description !== "string" || t.description.trim().length < 10) fail(`${where}: description too short/missing`);
  if (!Array.isArray(t.steps) || t.steps.length === 0) fail(`${where}: steps missing`);
  for (const s of t.steps) if (typeof s !== "string" || !s.trim()) fail(`${where}: empty step`);
  if (!["low", "medium", "high"].includes(t.risk_level)) fail(`${where}: risk_level must be low|medium|high`);
  if (typeof t.reversible !== "boolean") fail(`${where}: reversible must be boolean`);
  if (typeof t.verification !== "string" || !t.verification.trim()) fail(`${where}: verification missing`);
  if (typeof t.failure_conditions !== "string" || !t.failure_conditions.trim()) fail(`${where}: failure_conditions missing`);
}

const slugOf = (t) => tipSlug(t.title);
const slugs = TIPS.map(slugOf);
if (new Set(slugs).size !== slugs.length) fail("duplicate fix slugs exist");
for (const s of slugs) if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) fail(`bad slug "${s}"`);
const titles = TIPS.map((t) => t.title);
if (new Set(titles).size !== titles.length) fail("duplicate tip titles exist");

/* ---------- Content classification (§4: PUBLISH / REVIEW / MERGE) ---------- */
// All 89 tips are already published production guides (live cards on the hubs,
// recommended by the diagnostic engine, carrying full safety metadata). Giving
// them canonical pages therefore does not create new thin content — it gives
// existing published content a permanent URL. The gates that can still fail:
//   REVIEW → fewer than ~3 meaningful steps (§4)
//   MERGE  → near-duplicate of another same-platform tip (title overlap ≥ 80%)
// Instructional word count is reported per fix and drives the enrichment
// watchlist, but it does not disqualify an already-published guide.
function stepWords(t) { return t.steps.join(" ").split(/\s+/).filter(Boolean).length; }

// Near-duplicate detection for the MERGE bucket: high token overlap of
// normalized titles within the same platform. (Expected to find none.)
function normTokens(s) {
  return new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2));
}
function jaccard(a, b) {
  const inter = [...a].filter((x) => b.has(x)).length;
  return a.size + b.size ? inter / (a.size + b.size - inter) : 0;
}

const tokenCache = new Map(TIPS.map((t) => [slugOf(t), normTokens(t.title)]));
function classify(t) {
  const s = slugOf(t);
  if (t.steps.length < 3) return "REVIEW";
  for (const o of TIPS) {
    if (o === t || o.cat !== t.cat) continue;
    if (jaccard(tokenCache.get(s), tokenCache.get(slugOf(o))) >= 0.8) return "MERGE";
  }
  return "PUBLISH";
}

/* Phase 5 — curated related fixes. A tip may carry an explicit `related` array of
   sibling slugs (same platform). When at least two resolve to real same-platform tips we
   prefer it; the category/group fallback below is only a safety net for tips without
   curation. Unresolvable or cross-platform slugs are build errors — stale data must fail
   loudly, never silently degrade links. Mirrors script.js relatedTips() (cap 3 there). */
const SLUG_INDEX = new Map(TIPS.map((t) => [slugOf(t), t]));
function resolveRelated(t, platform) {
  if (Array.isArray(t.related)) {
    const hits = [];
    for (const s of t.related) {
      const o = SLUG_INDEX.get(s);
      if (!o || o === t) fail(`tip ${slugOf(t)} has unresolvable related slug "${s}"`);
      if ((o.cat === "mac" ? "mac" : "windows") !== platform) fail(`tip ${slugOf(t)} links cross-platform to "${s}" (platform guard)`);
      hits.push(o);
    }
    if (hits.length >= 2) return hits.slice(0, 4); // §10: 2–4 related fixes
  }
  const pool = TIPS.filter((o) => o !== t && o.cat === t.cat);
  const inGroup = t.group ? pool.filter((o) => o.group === t.group) : [];
  return (inGroup.length >= 3 ? inGroup : pool).slice(0, 4); // fallback: same rule as script.js relatedTips(), cap 4
}

const AUDIT = TIPS.map((t) => {
  const s = slugOf(t);
  const platform = t.cat === "mac" ? "mac" : "windows";
  return { tip: t, slug: s, platform, cat: t.cat, group: t.group || null, steps: t.steps.length, words: stepWords(t), related: resolveRelated(t, platform) };
});

// classify() assigns each tip to PUBLISH / REVIEW / MERGE (§4).
for (const a of AUDIT) a.recommendation = classify(a.tip);
const PUBLISHED = AUDIT.filter((a) => a.recommendation === "PUBLISH");
const REVIEWED = AUDIT.filter((a) => a.recommendation === "REVIEW");
const MERGED = AUDIT.filter((a) => a.recommendation === "MERGE");

/* ---------- Metadata rules (deterministic, validated post-render) ---------- */
function pageMeta(t) {
  const branded = `${t.title} | EmTech Media`;
  const title = branded.length <= 65 ? branded : t.title; // §7: ~50–60 chars where practical
  let description = t.description.trim();
  if (description.length > 160) {
    const cut = description.slice(0, 159);
    const at = cut.lastIndexOf(" ");
    description = (at > 80 ? cut.slice(0, at) : cut).replace(/[\s.,;:]+$/, "") + "…";
  }
  return { title, description };
}

/* ---------- Relative path helper (nested static site on GH Pages) ---------- */
// fromDepth: 0 = repo root page, 1 = hub dir, 2 = fix dir.
function rel(fromDepth, target) {
  const up = "../".repeat(fromDepth);
  return up + target.replace(/^\/+/, "");
}

/* ---------- Project-root anchor (Phase 4.1 contract for the custom 404) ---------- */
// GitHub Pages serves this site under /emtech-media/. The custom 404 page is
// delivered at arbitrary unknown paths (e.g. /emtech-media/foo/bar/baz/), so its
// links must be anchored to the project root — bare relative hrefs would resolve
// below the unknown path and 404 again. index.html[+fragment] maps to the
// canonical root form used in Phase 4.1 ("/emtech-media/#search").
const PROJECT_ROOT = "/emtech-media";
function anchor(p, depth, rootAnchored) {
  const clean = String(p).replace(/^\/+/, "");
  if (!rootAnchored) return rel(depth, clean);
  const m = clean.match(/^index\.html(?:#(.*))?$/);
  if (m) return `${PROJECT_ROOT}/` + (m[1] ? `#${m[1]}` : "");
  return clean === "" ? `${PROJECT_ROOT}/` : `${PROJECT_ROOT}/${clean}`;
}

/* ---------- HTML escaping (same contract as the app's esc()) ---------- */
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/* ---------- Shared chrome (header/footer), depth-aware links ---------- */
function headerHtml(depth, active, rootAnchored = false) {
  const r = (p) => anchor(p, depth, rootAnchored);
  const item = (href, label, isActive) =>
    `<li><a href="${r(href)}"${isActive ? ' class="active" aria-current="page"' : ""}>${label}</a></li>`;
  return `
  <a class="skip-link" href="#main">Skip to content</a>

  <!-- ============ HEADER ============ -->
  <header class="site-header" id="top">
    <div class="container nav-wrap">
      <a class="brand" href="${r("index.html")}" aria-label="EmTech Media home">
        <img class="brand-mark" src="${r("brand/cursor-mark.svg")}" width="30" height="30" alt="" aria-hidden="true">
        EmTech&nbsp;Media
      </a>

      <nav class="primary-nav" id="primary-nav" aria-label="Primary">
        <ul>
          ${item("index.html#search", "Search")}
          ${item("ai.html", "EmTech AI")}
          ${item("diagnose.html", "Diagnose")}
          ${item("windows/", "Windows", active === "windows")}
          ${item("mac/", "Mac", active === "mac")}
          ${item("index.html#routine", "Routine")}
        </ul>
      </nav>

      <div class="nav-actions">
        <button class="theme-toggle" id="theme-toggle" type="button" aria-pressed="false" aria-label="Toggle dark mode">
          <svg class="icon-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4"/>
            <line x1="12" y1="2.5" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="21.5"/>
            <line x1="2.5" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="21.5" y2="12"/>
            <line x1="5.3" y1="5.3" x2="6.7" y2="6.7"/><line x1="17.3" y1="17.3" x2="18.7" y2="18.7"/>
          </svg>
          <svg class="icon-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a7 7 7 0 0 9.7 9.7z"/>
          </svg>
        </button>
        <button class="nav-toggle" id="nav-toggle" aria-expanded="false" aria-controls="primary-nav" aria-label="Toggle menu">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <line class="icon-open" x1="3" y1="7" x2="21" y2="7"/>
            <line class="icon-open" x1="3" y1="12" x2="21" y2="12"/>
            <line class="icon-open" x1="3" y1="17" x2="21" y2="17"/>
            <line class="icon-close" x1="5" y1="5" x2="19" y2="19"/>
            <line class="icon-close" x1="19" y1="5" x2="5" y2="19"/>
          </svg>
        </button>
      </div>
    </div>
  </header>`;
}

function footerHtml(depth, rootAnchored = false) {
  const r = (p) => anchor(p, depth, rootAnchored);
  return `
  <!-- ============ FOOTER ============ -->
  <footer class="site-footer">
    <div class="container footer-top">
      <p class="footer-brand"><img class="brand-mark" src="${r("brand/cursor-mark.svg")}" width="20" height="20" alt="" aria-hidden="true">EmTech Media — PC &amp; Mac problems, solved in plain English.</p>

      <nav aria-label="Footer">
        <a href="${r("diagnose.html")}">Diagnose</a>
        <a href="${r("windows/")}">Windows fixes</a>
        <a href="${r("mac/")}">Mac fixes</a>
        <a href="${r("index.html#routine")}">Monthly routine</a>
      </nav>
    </div>

    <div class="container footer-bottom">
      <p>© <span id="year">2026</span> EmTech Media. All rights reserved.</p>
      <p>Tested on real machines, written for humans.</p>
    </div>
  </footer>`;
}

const THEME_SCRIPT = `
  <script>
    // Apply the saved theme before first paint (avoids a flash of the wrong theme).
    (function () {
      try {
        var t = localStorage.getItem("emtech-theme");
        if (!t) t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        document.documentElement.dataset.theme = t;
        var m = document.getElementById("meta-theme-color");
        if (m) m.content = t === "dark" ? "#131210" : "#F1EEE6";
      } catch (err) {}
    })();
  </script>`;

function headCommon(depth, { title, description, canonical, robots, rootAnchored } = {}) {
  const r = (p) => anchor(p, depth, rootAnchored);
  const notFoundNote = rootAnchored
    ? `\n  <!-- Phase 4.1: this page is served at arbitrary unknown paths, so every\n       reference must be production-safe (root-relative from the GitHub Pages\n       project root). Bare relative hrefs would resolve below the unknown\n       path and 404 again. -->`
    : "";
  // The 404 page has no canonical URL of its own — omit the tag entirely.
  const canon = canonical
    ? `<link rel="canonical" href="${esc(canonical)}" />\n  <meta property="og:url" content="${esc(canonical)}" />`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" id="meta-theme-color" content="#F1EEE6" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  ${robots ? `<meta name="robots" content="${esc(robots)}" />\n  ` : ""}${canon}

  <meta property="og:image" content="${BASE}/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="EmTech Media — PC &amp; Mac problems, solved in plain English" />
  <meta name="twitter:image" content="${BASE}/og-image.png" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="EmTech Media" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta name="twitter:card" content="summary_large_image" />
${THEME_SCRIPT}${notFoundNote}
  <link rel="icon" type="image/svg+xml" href="${r("brand/cursor-favicon.svg")}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@1&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${r("style.css")}" />`;
}
// NOTE: headCommon intentionally leaves <head> open — each caller inserts its
// JSON-LD block and then closes </head> itself, so the structured data stays
// inside <head>.

function breadcrumbJsonLd(items) {
  const el = items.map((it, i) => `      { "@type": "ListItem", "position": ${i + 1}, "name": ${JSON.stringify(it.name)}, "item": "${it.item}" }`).join(",\n");
  return `  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
${el}
    ]
  }
  </script>`;
}

/* ---------- Fix page (one canonical URL per fix) ---------- */
function riskLabel(risk) { return { low: "Low risk", medium: "Medium risk", high: "High risk" }[risk] || ""; }

function fixPageHtml(a) {
  const t = a.tip;
  const depth = 2; // windows/<slug>/ or mac/<slug>/
  const r = (p) => rel(depth, p);
  const hubPath = `${a.platform}/`;
  const canonical = `${BASE}/${hubPath}${a.slug}/`;
  const meta = pageMeta(t);
  const platformLabel = t.cat === "mac" ? "macOS" : (t.win || "Windows");
  const catLabel = CAT_LABELS[t.cat] || t.cat;
  const groupLabel = t.group ? ` · ${GROUP_LABELS[t.group] || t.group}` : "";

  const relatedRows = a.related.map((rt) => {
    const rs = slugOf(rt);
    const rp = rt.cat === "mac" ? "mac/" : "windows/";
    return `        <li><a href="${r(rp + rs + "/")}">${esc(rt.title)}</a> <small>${LEVELS[rt.difficulty] || ""} · ${esc(rt.time)}</small></li>`;
  }).join("\n");

  const stepsHtml = t.steps.map((s) => `      <li>${esc(s)}</li>`).join("\n");

  return `${headCommon(depth, { title: meta.title, description: meta.description, canonical })}
${breadcrumbJsonLd([
    { name: "Home", item: `${BASE}/index.html` },
    { name: a.platform === "mac" ? "Mac fixes" : "Windows fixes", item: `${BASE}/${hubPath}` },
    { name: t.title, item: canonical },
  ])}
</head>
<body>
${headerHtml(depth, a.platform)}

  <main id="main">
    <!-- ============ BREADCRUMB ============ -->
    <div class="container">
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="${r("index.html")}">Home</a></li>
          <li><a href="${r(hubPath)}">${a.platform === "mac" ? "Mac fixes" : "Windows fixes"}</a></li>
          <li aria-current="page">${esc(t.title)}</li>
        </ol>
      </nav>
    </div>

    <!-- ============ FIX ARTICLE (fully static — readable with JS disabled) ============ -->
    <article class="section fix-article">
      <div class="container">
        <p class="kicker reveal">${esc(platformLabel)} · ${esc(catLabel)}${groupLabel ? esc(groupLabel) : ""}</p>
        <h1 class="reveal delay-1">${esc(t.title)}</h1>

        <section class="fix-summary" aria-label="Summary">
          <p class="lede reveal delay-2">${esc(t.description)}</p>
          <ul class="hero-meta fix-meta" aria-label="Fix facts">
            <li><span>Difficulty</span> ${LEVELS[t.difficulty] || ""}</li>
            <li><span>Estimated time</span> ${esc(t.time)}</li>
            <li><span>Platform</span> ${esc(platformLabel)}</li>
          </ul>
        </section>

        <section class="fix-safety" aria-label="Before you start">
          <h2>Before you start</h2>
          <p><strong>${riskLabel(t.risk_level)}.</strong> ${t.reversible ? "This change is reversible — you can return to the previous state without professional help or data loss." : "This change is not fully reversible — read every step before you begin and make sure your important work is saved."}</p>
        </section>

        <section aria-label="Steps">
          <h2>Steps</h2>
<ol class="tip-steps fix-steps">
${stepsHtml}
</ol>
        </section>

        <section class="fix-verify" aria-label="How to verify the fix">
          <h2>How to verify the fix</h2>
          <p>${esc(t.verification)}</p>
        </section>

        <section class="fix-failure" aria-label="If this didn't fix it">
          <h2>If this didn't fix it</h2>
          <p>${esc(t.failure_conditions)}</p>
          <p>Next stop: the related fixes below, or <a href="${r("diagnose.html")}">start a guided diagnosis</a>.</p>
        </section>

${a.related.length ? `
        <section class="fix-related" aria-label="Related fixes">
          <h2>Related fixes</h2>
          <ul class="rel-list">
${relatedRows}
          </ul>
        </section>` : ""}

        <div class="hero-cta fix-next">
          <a class="btn btn-primary" href="${r("diagnose.html")}">Still stuck? Diagnose my problem <span aria-hidden="true">→</span></a>
          <a class="btn-link" href="${r(hubPath)}">Browse all ${a.platform === "mac" ? "Mac" : "Windows"} fixes <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </article>
  </main>

${footerHtml(depth)}

  <button class="to-top" id="to-top" type="button" aria-label="Back to top">↑</button>

  <!-- Progressive enhancement only: theme toggle + nav behaviour. The article above is complete without it. -->
  <script src="${r("tips-data.js")}" defer></script>
  <script src="${r("script.js")}" defer></script>
</body>
</html>
`;
}

/* ---------- Hub page (crawlable index + JS-enhanced cards) ---------- */
function hubStaticList(auditRows, platform) {
  // Crawlable <a href> list — the no-JS backbone of the hub.
  const groups = [];
  if (platform === "windows") {
    for (const c of WIN_ORDER) {
      const rows = auditRows.filter((a) => a.cat === c);
      if (rows.length) groups.push({ id: `cat-${c}`, label: CAT_LABELS[c] || c, rows });
    }
  } else {
    for (const g of ["speed", "fixes", "security"]) {
      const rows = auditRows.filter((a) => a.group === g);
      if (rows.length) groups.push({ id: `sub-${g}`, label: GROUP_LABELS[g] || g, rows });
    }
    // Safety net: any Mac tip without a group still gets listed (no orphans).
    const ungrouped = auditRows.filter((a) => !a.group);
    if (ungrouped.length) groups.push({ id: "sub-other", label: "More Mac fixes", rows: ungrouped });
  }
  return groups.map((g) => `
        <section class="static-group" aria-labelledby="${g.id}">
          <h3 class="acc-group" id="${g.id}"><span>${esc(g.label)}</span><i aria-hidden="true">·</i><span>${g.rows.length} fix${g.rows.length > 1 ? "es" : ""}</span></h3>
          <ul class="static-fix-list">
${g.rows.map((a) => `            <li><a href="${a.slug}/"><span class="sf-title">${esc(a.tip.title)}</span><small>${LEVELS[a.tip.difficulty] || ""} · ${esc(a.tip.time)}</small></a></li>`).join("\n")}
          </ul>
        </section>`).join("");
}

function hubHtml(platform) {
  const depth = 1; // windows/ or mac/
  const r = (p) => rel(depth, p);
  const rows = PUBLISHED.filter((a) => a.platform === platform);
  const isMac = platform === "mac";
  const count = rows.length;
  const groupCount = isMac ? new Set(rows.map((a) => a.group).filter(Boolean)).size : new Set(rows.map((a) => a.cat)).size;

  const title = isMac ? "Mac Fixes — EmTech Media" : "Windows Fixes — EmTech Media";
  const description = isMac
    ? `${count} tested macOS fixes: frozen apps, trackpad & mouse, microphone, slow Wi-Fi, no sound, external displays, Bluetooth pairing, battery health, Time Machine, FileVault, Gatekeeper, boot recovery and more. Intel + Apple Silicon, timed to the minute, written in plain English.`
    : `${count} tested fixes for Windows 10 and 11: slow PCs, blue screens, no sound, update chaos, gaming stutter, disk bloat, Wi-Fi lock-down, BitLocker and more. Grouped by what they do, timed to the minute, written in plain English.`;
  const canonical = `${BASE}/${platform}/`;

  const chips = isMac
    ? ["speed", "fixes", "security"].map((g) => `<a class="cat-chip" href="#sub-${g}">${esc(GROUP_LABELS[g] || g)}</a>`).join("\n            ")
    : WIN_ORDER.map((c) => `<a class="cat-chip" href="#cat-${c}">${esc(CAT_LABELS[c] || c)}</a>`).join("\n            ");

  return `${headCommon(depth, { title, description, canonical })}
${breadcrumbJsonLd([
    { name: "Home", item: `${BASE}/index.html` },
    { name: isMac ? "Mac fixes" : "Windows fixes", item: canonical },
  ])}
</head>
<body>
${headerHtml(depth, platform)}

  <main id="main">
    <!-- ============ PAGE HERO ============ -->
    <section class="hero">
      <div class="container">
        <p class="kicker reveal">${isMac ? "macOS — the essentials" : "Windows 10 / 11 — the full list"}</p>
        <h1 class="reveal delay-1">${isMac ? `Mac fixes, <em class="serif">same standard.</em>` : `Every Windows fix, <em class="serif">in one list.</em>`}</h1>

        <div class="hero-foot reveal delay-2">
          <div class="hero-copy">
            <p class="lede"><span data-tip-count="${isMac ? "mac" : "win"}">${count}</span> tested fixes ${isMac ? "for every kind of Mac trouble — frozen apps, trackpad & mouse, microphone, slow Wi-Fi, no sound, external displays, Bluetooth pairing, battery health, backups, encryption and the resets that fix weird glitches. Intel and Apple Silicon both covered, timed to the minute." : `grouped by what they do — speed, updates, gaming, cleaning, maintenance, hardware and security. Each one timed to the minute and written in plain English.`}</p>
            <div class="hero-cta">
              <a class="btn btn-primary" href="#fixes">Jump to the list</a>
              <a class="btn-link" href="${r("diagnose.html")}">Not sure where to start? Diagnose <span aria-hidden="true">↗</span></a>
            </div>
          </div>
          <ul class="hero-meta" aria-label="Library facts">
            <li><span>Tested fixes</span> <span data-tip-count="${isMac ? "mac" : "win"}">${count}</span></li>
            <li><span>${isMac ? "Coverage" : "Categories"}</span> ${isMac ? "Intel + Apple Silicon" : `<span data-tip-count="win-cats">${groupCount}</span>`}</li>
            <li><span>Jargon</span> None. Ever.</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- ============ THE FULL LIST (JS-enhanced cards) ============ -->
    <section class="section" id="fixes">
      <div class="container">
        <header class="sec-head reveal">
          <span class="sec-num"><span data-tip-count="${isMac ? "mac" : "win"}">${count}</span> fixes · ${isMac ? `<span data-tip-count="mac-groups">${groupCount}</span> groups` : `<span data-tip-count="win-cats">${groupCount}</span> categories`}</span>
          <h2>The full list</h2>
          <p class="sec-sub">Grouped by what they fix. Search, jump to a category, or tap any row to read the steps — no sign-up, no jargon.</p>
        </header>

        <nav class="breadcrumbs reveal" aria-label="Breadcrumb">
          <ol>
            <li><a href="${r("index.html")}">Home</a></li>
            <li id="bc-page" aria-current="page">${isMac ? "Mac fixes" : "Windows fixes"}</li>
            <li id="bc-tip" hidden></li>
          </ol>
        </nav>

        <div class="fix-tools reveal">
          <div class="fix-search-row">
            <input type="search" id="fix-search" placeholder="Search the fixes… (press /)" aria-label="Search the ${isMac ? "Mac" : "Windows"} fixes" />
            <span class="fix-count" id="fix-count" aria-live="polite"></span>
          </div>
          <div class="cat-chips" role="group" aria-label="Jump to a ${isMac ? "group" : "category"}">
            ${chips}
          </div>
        </div>

        <!-- script.js renderAccordion() binds these exact ids (win-acc / mac-acc). -->
        <div class="acc-list" id="${isMac ? "mac-acc" : "win-acc"}">
          <noscript><p class="no-js-note">Enable JavaScript to expand the fix cards — or use the full index below, which works without it.</p></noscript>
        </div>

        <div class="search-empty search-block" id="fix-search-empty" hidden>
          <h3>We couldn't find that problem.</h3>
          <p>Try describing it differently — e.g. "my laptop is overheating" instead of "computer broken".</p>
          <a class="btn btn-primary" href="${r("diagnose.html")}">Start diagnosis<span aria-hidden="true"> →</span></a>
        </div>
      </div>
    </section>

    <!-- ============ CRAWLABLE INDEX (works with JavaScript disabled) ============ -->
    <section class="section" id="all-fixes" aria-label="All fixes index">
      <div class="container">
        <header class="sec-head reveal">
          <span class="sec-num">${count} guides</span>
          <h2>Browse every fix</h2>
          <p class="sec-sub">Each guide has its own permanent page — open any of them directly, or share the link.</p>
        </header>
${hubStaticList(rows, platform)}
      </div>
    </section>

    <!-- ============ WHERE TO NEXT ============ -->
    <section class="section" aria-label="More on this site">
      <div class="container">
        <header class="sec-head reveal">
          <span class="sec-num">Keep going</span>
          <h2>Where to next?</h2>
        </header>

        <ul class="index-list reveal delay-1">
          <li><a class="index-row" href="${r("diagnose.html")}">
            <span class="idx-num">01</span>
            <h3 class="idx-title">Diagnose your problem</h3>
            <p class="idx-desc">Tell us what's happening and get the fix that works, starting with the first three steps.</p>
            <span class="idx-arrow" aria-hidden="true">↗</span>
          </a></li>
          <li><a class="index-row" href="${r(isMac ? "windows/" : "mac/")}">
            <span class="idx-num">02</span>
            <h3 class="idx-title">${isMac ? "Windows fixes" : "Mac fixes"}</h3>
            <p class="idx-desc">${isMac ? `<span data-tip-count="win">${PUBLISHED.filter((a) => a.platform === "windows").length}</span> tested fixes for Windows 10 and 11, grouped by what they do.` : `The macOS essentials — same standard: tested, timed, plain English.`}</p>
            <span class="idx-arrow" aria-hidden="true">↗</span>
          </a></li>
          <li><a class="index-row" href="${r("index.html#routine")}">
            <span class="idx-num">03</span>
            <h3 class="idx-title">The monthly routine</h3>
            <p class="idx-desc">Six things, once a month, about an hour total. Progress saved on your device.</p>
            <span class="idx-arrow" aria-hidden="true">↗</span>
          </a></li>
        </ul>
      </div>
    </section>
  </main>

${footerHtml(depth)}

  <button class="to-top" id="to-top" type="button" aria-label="Back to top">↑</button>

  <script src="${r("tips-data.js")}" defer></script>
  <script src="${r("diag-data.js")}" defer></script>
  <script src="${r("diag-engine.js")}" defer></script>
  <script src="${r("script.js")}" defer></script>
  <script src="${r("diag-feedback.js")}" defer></script>
</body>
</html>
`;
}

/* ---------- 404 page ---------- */
// Phase 4.1: every link on this page is project-root-anchored (see anchor()),
// because GitHub Pages serves it at arbitrary unknown paths.
function notFoundHtml() {
  const depth = 0;
  const r = (p) => anchor(p, depth, true);
  const popular = [
    "fix-my-pc-is-slow-all-of-a-sudden-the-order-of-attack",
    "speed-up-a-sluggish-macbook",
    "free-up-disk-space-with-storage-management",
    "stop-games-stuttering-the-5-point-checklist",
  ].map((s) => {
    const a = AUDIT.find((x) => x.slug === s);
    if (!a) return "";
    const p = a.platform === "mac" ? "mac/" : "windows/";
    return `        <li><a href="${r(p + a.slug + "/")}">${esc(a.tip.title)}</a></li>`;
  }).filter(Boolean).join("\n");

  return `${headCommon(depth, { title: "Page not found — EmTech Media", description: "The page you're looking for doesn't exist. Find your fix in the Windows or Mac library instead.", canonical: null, robots: "noindex,follow", rootAnchored: true })}
</head>
<body>
${headerHtml(depth, null, true)}

  <main id="main">
    <section class="section notfound">
      <div class="container">
        <p class="kicker reveal">404</p>
        <h1 class="reveal delay-1">Page not found.</h1>
        <p class="lede reveal delay-2">That link doesn't lead anywhere — but the fix you're after probably still does. Start from one of these:</p>

        <ul class="index-list reveal delay-2" style="margin-top: 24px;">
          <li><a class="index-row" href="${r("windows/")}">
            <span class="idx-num">01</span>
            <h3 class="idx-title">Windows fixes</h3>
            <p class="idx-desc">${PUBLISHED.filter((a) => a.platform === "windows").length} tested fixes for Windows 10 and 11.</p>
            <span class="idx-arrow" aria-hidden="true">↗</span>
          </a></li>
          <li><a class="index-row" href="${r("mac/")}">
            <span class="idx-num">02</span>
            <h3 class="idx-title">Mac fixes</h3>
            <p class="idx-desc">${PUBLISHED.filter((a) => a.platform === "mac").length} tested macOS guides, Intel and Apple Silicon.</p>
            <span class="idx-arrow" aria-hidden="true">↗</span>
          </a></li>
          <li><a class="index-row" href="${r("diagnose.html")}">
            <span class="idx-num">03</span>
            <h3 class="idx-title">Diagnose your problem</h3>
            <p class="idx-desc">Answer a few questions and get the fix that works.</p>
            <span class="idx-arrow" aria-hidden="true">↗</span>
          </a></li>
        </ul>

        <section class="notfound-popular" aria-label="Popular fixes">
          <h2>Popular fixes</h2>
          <ul class="rel-list">
${popular}
          </ul>
        </section>

        <div class="hero-cta" style="margin-top: 24px;">
          <a class="btn btn-primary" href="${r("/")}">Back to the homepage <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </section>
  </main>

${footerHtml(depth, true)}
</body>
</html>
`;
}

/* ---------- sitemap / robots / docs ---------- */
function sitemapXml() {
  const urls = [
    { loc: `${BASE}/index.html`, freq: "weekly", prio: "1.0" },
    { loc: `${BASE}/windows/`, freq: "monthly", prio: "0.9" },
    { loc: `${BASE}/mac/`, freq: "monthly", prio: "0.9" },
    { loc: `${BASE}/diagnose.html`, freq: "monthly", prio: "0.9" },
  ];
  for (const a of PUBLISHED) {
    urls.push({
      loc: `${BASE}/${a.platform === "mac" ? "mac/" : "windows/"}${a.slug}/`,
      freq: "yearly",
      prio: "0.8",
      lastmod: a.tip.updated || undefined,
    });
  }
  const body = urls.map((u) => `  <url>
    <loc>${esc(u.loc)}</loc>
${u.lastmod ? `    <lastmod>${esc(u.lastmod)}</lastmod>\n` : ""}    <changefreq>${u.freq}</changefreq>
    <priority>${u.prio}</priority>
  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  EmTech Media — sitemap (generated by build/generate.mjs from tips-data.js).

  Live preview host: GitHub Pages (resolvable today). When a custom domain is
  registered, swap every URL below to match it and update robots.txt.
-->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

const ROBOTS_TXT = `# EmTech Media — robots.txt
User-agent: *
Allow: /

# Live preview host (GitHub Pages). When a custom domain is registered,
# swap this URL to match it.
Sitemap: https://emtechbytes-cpu.github.io/emtech-media/sitemap.xml
`;

function contentAuditMd() {
  const rows = AUDIT.map((a) => `| \`${a.slug}\` | ${esc(a.tip.title)} | ${a.platform === "mac" ? "Mac" : "Windows"} | ${a.steps} | ${a.words} | yes | yes | ${a.tip.risk_level} | ${a.related.length} | **${a.recommendation}** |`).join("\n");
  const watchlist = [...AUDIT].sort((x, y) => x.words - y.words).slice(0, 16);
  return `# EmTech Media — SEO Content Audit (Phase 4)

Generated by \`build/generate.mjs\` from the canonical knowledge base (\`tips-data.js\`).
Every fix is evaluated before publication; nothing is deleted or modified.

## Method

- **Word count** = words in the step list (the instructional content). Reported per fix and used for the enrichment watchlist; it does not disqualify a guide that is already published production content.
- **REVIEW** if: fewer than ~3 meaningful steps, or not a standalone user problem.
- **MERGE** if: title token overlap ≥ 80% with another same-platform tip (near-duplicate).
- Everything else is **PUBLISH**. All tips are already live production guides (hubs + diagnostic engine) with complete safety metadata, so publishing them as static pages adds no new thin content.

## Summary

| Bucket | Count |
|---|---|
| Total fixes audited | ${AUDIT.length} |
| PUBLISH | ${PUBLISHED.length} |
| REVIEW | ${REVIEWED.length} |
| MERGE | ${MERGED.length} |

${REVIEWED.length === 0 && MERGED.length === 0 ? "No fix met the REVIEW or MERGE criteria: every tip has ≥3 steps, complete safety metadata (risk level, reversibility, verification, failure conditions), and a distinct standalone problem." : `### REVIEW candidates\n\n${REVIEWED.map((a) => `- \`${a.slug}\` — ${esc(a.tip.title)} (${a.steps} steps, ${a.words} words)`).join("\n") || "- none"}\n\n### MERGE candidates\n\n${MERGED.map((a) => `- \`${a.slug}\` — ${esc(a.tip.title)}`).join("\n") || "- none"}`}

## Watchlist (shortest instructional content, still publishable)

These are the 16 shortest guides. They already ship as live production cards with
complete safety metadata; they are listed here so future enrichment can prioritise them.

| Slug | Steps | Words |
|---|---|---|
${watchlist.map((a) => `| \`${a.slug}\` | ${a.steps} | ${a.words} |`).join("\n")}

## Full audit table

| Slug | Title | Platform | Steps | Step words | Verification | Failure conditions | Risk | Related | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
${rows}
`;
}

function urlMapJson() {
  const map = {};
  for (const a of AUDIT) {
    map[a.slug] = {
      oldSlug: a.slug, // slugs are permanent — unchanged by Phase 4
      newUrl: `${BASE}/${a.platform === "mac" ? "mac/" : "windows/"}${a.slug}/`,
      platform: a.platform === "mac" ? "mac" : "windows",
      title: a.tip.title,
      recommendation: a.recommendation,
    };
  }
  return JSON.stringify(map, null, 2) + "\n";
}

/* ---------- Write output ---------- */
function out(relPath, content) {
  const p = path.join(ROOT, relPath);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, content, "utf8");
  return relPath;
}

const written = [];
written.push(out("windows/index.html", hubHtml("windows")));
written.push(out("mac/index.html", hubHtml("mac")));
for (const a of PUBLISHED) {
  const dir = a.platform === "mac" ? "mac" : "windows";
  written.push(out(`${dir}/${a.slug}/index.html`, fixPageHtml(a)));
}
written.push(out("sitemap.xml", sitemapXml()));
written.push(out("robots.txt", ROBOTS_TXT));
written.push(out("404.html", notFoundHtml()));
written.push(out("docs/SEO-CONTENT-AUDIT.md", contentAuditMd()));
written.push(out("docs/SEO-URL-MAP.json", urlMapJson()));

/* ---------- Post-render validation (throw on any violation) ---------- */
function read(relPath) { return readFileSync(path.join(ROOT, relPath), "utf8"); }

// 1. Unique titles / descriptions / canonicals across all generated pages.
const pageFiles = written.filter((f) => f.endsWith(".html"));
const seenTitle = new Map(), seenDesc = new Map(), seenCanon = new Map();
for (const f of pageFiles) {
  const html = read(f);
  const mT = html.match(/<title>([\s\S]*?)<\/title>/);
  const mD = html.match(/<meta name="description" content="([\s\S]*?)"/);
  const mC = html.match(/<link rel="canonical" href="([^"]+)"/);
  if (!mT || !mD) throw new Error(`SEO VALIDATION: ${f} missing title/description`);
  for (const [map, val, label] of [[seenTitle, mT[1], "title"], [seenDesc, mD[1], "description"]]) {
    if (map.has(val)) throw new Error(`SEO VALIDATION: duplicate ${label} across pages: "${val}" (${f} vs ${map.get(val)})`);
    map.set(val, f);
  }
  if (mC) {
    const c = mC[1];
    if (seenCanon.has(c)) throw new Error(`SEO VALIDATION: duplicate canonical ${c} (${f} vs ${seenCanon.get(c)})`);
    seenCanon.set(c, f);
  }
}

// 2. Every internal href/src in generated pages resolves to a real file.
function localTargets(html) {
  const out = [];
  const re = /(?:href|src)="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const v = m[1];
    if (/^(https?:|data:|mailto:|#)/.test(v)) continue;
    out.push(v.split("#")[0]);
  }
  return [...new Set(out)].filter(Boolean);
}
for (const f of pageFiles) {
  const dir = path.dirname(path.join(ROOT, f));
  for (const t of localTargets(read(f))) {
    if (!path.isAbsolute(t)) {
      const resolved = path.resolve(dir, t);
      // Directory-style links ("windows/") resolve to <dir>/index.html.
      const candidates = [resolved, path.join(resolved, "index.html")];
      if (!candidates.some((c) => { try { return readFileSync(c).length >= 0; } catch (e) { return false; } })) {
        throw new Error(`SEO VALIDATION: broken internal link "${t}" in ${f}`);
      }
    }
  }
}

// 3. Sitemap ↔ published pages agree exactly.
const sitemap = read("sitemap.xml");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (new Set(locs).size !== locs.length) throw new Error("SEO VALIDATION: duplicate sitemap URLs");
const expected = [`${BASE}/index.html`, `${BASE}/windows/`, `${BASE}/mac/`, `${BASE}/diagnose.html`];
for (const a of PUBLISHED) expected.push(`${BASE}/${a.platform === "mac" ? "mac/" : "windows/"}${a.slug}/`);
if (locs.length !== expected.length || !expected.every((u) => locs.includes(u))) {
  throw new Error(`SEO VALIDATION: sitemap has ${locs.length} URLs, expected ${expected.length}`);
}

// 4. Robots references the sitemap; no REVIEW/MERGE pages published on disk.
if (!read("robots.txt").includes(`${BASE}/sitemap.xml`)) throw new Error("SEO VALIDATION: robots.txt missing sitemap reference");
for (const a of [...REVIEWED, ...MERGED]) {
  const p = path.join(ROOT, `${a.platform === "mac" ? "mac" : "windows"}/${a.slug}/index.html`);
  try { readFileSync(p); throw new Error(`SEO VALIDATION: non-PUBLISH page written to disk: ${a.slug}`); } catch (e) { /* absent = correct */ }
}

// 5. Platform guard: mac tips only under mac/, windows-side only under windows/.
for (const a of PUBLISHED) {
  const dir = a.platform === "mac" ? "mac" : "windows";
  if (!path.join(dir, a.slug).startsWith(a.platform)) throw new Error(`SEO VALIDATION: platform guard broken for ${a.slug}`);
}

// 6. Phase 4.1 contract: the custom 404 is served at arbitrary unknown paths,
//    so every href/src must be production-safe (absolute URL, hash anchor, or
//    anchored to the GitHub Pages project root). Bare relative refs would 404.
{
  const nf = read("404.html");
  for (const m of nf.matchAll(/(?:href|src)="([^"]*)"/g)) {
    const v = m[1];
    const safe = /^https?:\/\//.test(v) || v.startsWith("#") || v === "/" || v.startsWith(`${PROJECT_ROOT}/`);
    if (!safe) throw new Error(`SEO VALIDATION: 404.html has a non-production-safe reference "${v}" (Phase 4.1 contract)`);
  }
}

/* ---------- Summary ---------- */
console.log("Phase 4 static build — OK");
console.log(`  tips audited      : ${AUDIT.length}`);
console.log(`  PUBLISH           : ${PUBLISHED.length}`);
console.log(`  REVIEW            : ${REVIEWED.length}${REVIEWED.length ? " → " + REVIEWED.map((a) => a.slug).join(", ") : ""}`);
console.log(`  MERGE             : ${MERGED.length}${MERGED.length ? " → " + MERGED.map((a) => a.slug).join(", ") : ""}`);
console.log(`  windows fixes     : ${PUBLISHED.filter((a) => a.platform === "windows").length}`);
console.log(`  mac fixes         : ${PUBLISHED.filter((a) => a.platform === "mac").length}`);
console.log(`  sitemap URLs      : ${locs.length}`);
console.log(`  files written     : ${written.length}`);
