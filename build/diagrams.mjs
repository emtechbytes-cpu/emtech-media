/* ============================================================
   EmTech Media — deterministic figure renderer (Phase: fix-page images)
   ----------------------------------------------------------
   Renders every spec in diagrams/specs.js into an 800×540 SVG that
   matches the hand-crafted figures' visual language exactly
   (reference: diagrams/win-startup-bloat.svg):

     paper #f1eee6 · panels #e9e5d8 / light #f7f5ee · ink #131210
     muted #5f5b50 · hairline rgba(19,18,16,.18) · accent lime #c8f03c
     IBM Plex Mono labels + Instrument Serif italic title (fallbacks only —
     SVG-in-<img> blocks external font fetches)

   Canonical wiring lives in tips-data.js (`diagram` field). This script:
     1. cross-checks specs ↔ tips (unknown slugs, missing wiring,
        duplicate file names → fail fast);
     2. renders each spec to diagrams/<file> — byte-identical on every run;
     3. regenerates diagrams/preview.html from the same data so it can
        never go stale again.

   FIG numbers continue after the hand-crafted figures (FIG. 01–23) and are
   assigned in tips-data.js order, starting at FIG. 24.

   Text budgets below are enforced geometrically — a spec that would clip
   or overflow its panel fails the build instead of shipping broken art.

   Run:  node build/diagrams.mjs
   No dependencies. Node >= 18 (ESM + fs).
   ============================================================ */

import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ---------- Canonical data (single source of truth) ---------- */
// tips-data.js is CommonJS; Node's ESM/CJS interop gives the exports object
// as the default import — same pattern build/generate.mjs uses.
import tipsModule from "../tips-data.js";
const TIPS = (tipsModule && tipsModule.TIPS) || (tipsModule.default && tipsModule.default.TIPS);
const tipSlug = (tipsModule && tipsModule.tipSlug) || (tipsModule.default && tipsModule.default.tipSlug);

// diagrams/specs.js is CommonJS too.
import specsModule from "../diagrams/specs.js";
const SPECS = (specsModule && specsModule.SPECS) || (specsModule.default && specsModule.default.SPECS);

if (!Array.isArray(TIPS) || typeof tipSlug !== "function") {
  throw new Error("tips-data.js did not expose TIPS + tipSlug — canonical data source broken.");
}
if (!SPECS || typeof SPECS !== "object" || Object.keys(SPECS).length === 0) {
  throw new Error("diagrams/specs.js did not expose SPECS — nothing to render.");
}

const LEVELS = { 1: "EASY", 2: "MEDIUM", 3: "ADVANCED" };

/* ---------- Palette + shared constants (mirror the hand-crafted figures) ---------- */
const PAPER = "#f1eee6";
const PANEL = "#e9e5d8";
const LIGHT = "#f7f5ee";
const INK = "#131210";
const MUTED = "#5f5b50";
const HAIR = "rgba(19,18,16,.18)";
const LIME = "#c8f03c";

/* ---------- Small helpers ---------- */
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Fail fast on text that would clip — never ship a figure with cut-off words.
function budget(str, max, what) {
  if (typeof str !== "string" || !str.trim()) throw new Error(`FIGURE DATA: ${what} is empty`);
  if (str.length > max) {
    throw new Error(`TEXT BUDGET EXCEEDED: ${what} is ${str.length} chars (max ${max}): "${str}" — shorten it in diagrams/specs.js`);
  }
  return str;
}

// Wrap a label into up to `lines` chunks of ≤ maxChars at word boundaries.
function wrap(text, maxChars, lines) {
  const words = String(text).split(/\s+/);
  const out = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= maxChars) cur += " " + w;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  if (out.length > lines) throw new Error(`TEXT BUDGET EXCEEDED: "${text}" needs ${out.length} lines (max ${lines})`);
  return out;
}

const txt = (x, y, s, o = {}) =>
  `<text class="${o.serif ? "serif" : "mono"}" x="${x}" y="${y}" font-size="${o.size || 12}"${o.weight ? ` font-weight="${o.weight}"` : ""}${o.ls ? ` letter-spacing="${o.ls}"` : ""} fill="${o.fill || INK}"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}>${esc(s)}</text>`;

const rect = (x, y, w, h, o = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}"${o.rx != null ? ` rx="${o.rx}"` : ""} fill="${o.fill || "none"}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1.5}"` : ""}${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}/>`;

const line = (x1, y1, x2, y2, o = {}) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.stroke || INK}" stroke-width="${o.sw || 1.5}"/>`;

const arrowHead = (x, y) =>
  `<path d="M ${x - 7} ${y - 4} L ${x} ${y} L ${x - 7} ${y + 4}" fill="none" stroke="${INK}" stroke-width="1.5"/>`;

/* ---------- Shared chrome: header, caption strip, note box/strip ---------- */
function header(fig, platform, kicker, title, meta) {
  budget(title, 40, "serif title");
  return [
    txt(48, 52, `FIG. ${String(fig).padStart(2, "0")} — ${platform} · ${kicker.toUpperCase()}`, { size: 11, ls: 2, fill: MUTED }),
    txt(48, 88, title, { serif: true, size: 30 }),
    txt(752, 52, meta, { size: 11, ls: 1.5, fill: MUTED, anchor: "end" }),
  ].join("\n");
}

function caption(capL) {
  if (!capL) return "";
  budget(capL, 80, "caption (left)");
  return [
    line(70, 482, 730, 482, { stroke: HAIR, sw: 1 }),
    txt(70, 506, capL, { size: 10.5, ls: 1, fill: MUTED }),
  ].join("\n");
}

// Right-hand note box (used by steps + window layouts when a note is present).
function noteBox(note) {
  const x = 520, y = 170, w = 210;
  let inner = "";
  if (note && typeof note === "object" && !Array.isArray(note)) {
    budget(note.title, 18, "note title");
    inner += txt(x + 16, y + 28, note.title.toUpperCase(), { size: 9.5, ls: 1, weight: 600 });
    (note.lines || []).forEach((l, i) => {
      budget(l, 24, "note line");
      inner += txt(x + 16, y + 50 + i * 18, l, { size: 11, fill: MUTED });
    });
  } else if (Array.isArray(note)) {
    note.forEach((l, i) => {
      budget(l, 24, "note line");
      inner += txt(x + 16, y + 30 + i * 18, l, { size: 11, fill: MUTED });
    });
  } else if (typeof note === "string") {
    budget(note, 24, "note line");
    inner += txt(x + 16, y + 30, note, { size: 11, fill: MUTED });
  }
  return rect(x, y, w, 118, { fill: LIGHT, stroke: HAIR }) + "\n" + inner;
}

// Full-width bottom strip (used by flow / bars / device notes).
function noteStrip(note) {
  if (!note) return "";
  const x = 70, y = 380, w = 660;
  let h = 44, inner = "";
  if (note && typeof note === "object" && !Array.isArray(note)) {
    budget(note.title, 20, "strip title");
    const joined = (note.lines || []).map((l) => budget(l, 30, "strip line")).join(" · ");
    h = 64;
    inner += txt(x + 20, y + 24, note.title.toUpperCase(), { size: 9.5, ls: 1, weight: 600 });
    inner += txt(x + 20, y + 46, joined, { size: 11, fill: MUTED });
  } else {
    const text = Array.isArray(note) ? note.join(" · ") : String(note);
    budget(text, 70, "strip note");
    inner += txt(x + 20, y + 28, text, { size: 11.5, fill: MUTED });
  }
  return rect(x, y, w, h, { fill: LIGHT, stroke: HAIR }) + "\n" + inner;
}

/* ---------- Layouts ---------- */

function layoutSteps(spec) {
  const rows = spec.rows || [];
  if (!rows.length) throw new Error("steps layout needs rows[]");
  budget(rows.join("|"), 400, "steps content (total)");
  const hasNote = !!spec.note;
  const pw = hasNote ? 430 : 660;
  const maxChars = hasNote ? 42 : 64;
  let out = rect(70, 120, pw, 330, { fill: PANEL, stroke: INK, sw: 2 });
  const H = 280, top0 = 156;
  const rowH = Math.min(58, Math.floor(H / rows.length));
  const startY = top0 + Math.max(0, Math.round((H - rows.length * rowH) / 2));
  rows.forEach((r, i) => {
    budget(r, maxChars, `steps row ${i + 1}`);
    const t = startY + i * rowH;
    const cy = t + rowH / 2 + 4;
    if (spec.hl === i) out += rect(84, t + 7, pw - 28, rowH - 14, { fill: LIME });
    out += txt(102, cy, String(i + 1), { size: 12, weight: 600, fill: spec.hl === i ? INK : MUTED });
    out += txt(132, cy, r, { size: 12.5, weight: spec.hl === i ? 600 : undefined });
  });
  if (hasNote) out += "\n" + noteBox(spec.note);
  return out;
}

function layoutWindow(spec) {
  const rows = spec.rows || [];
  if (!rows.length) throw new Error("window layout needs rows[]");
  budget(spec.winTitle, 60, "window title bar");
  const hasNote = !!spec.note;
  const pw = hasNote ? 430 : 660;
  const pR = 70 + pw;
  let out = rect(70, 120, pw, 330, { fill: PANEL, stroke: INK, sw: 2 });
  // title bar chrome (mirrors the hand-crafted Task Manager figure)
  out += line(70, 154, pR, 154, { stroke: HAIR, sw: 1 });
  out += rect(88, 132, 10, 10, { fill: INK });
  out += txt(106, 141, spec.winTitle, { size: 11, fill: MUTED });
  out += line(pR - 62, 137, pR - 48, 137);
  out += `<line x1="${pR - 30}" y1="131" x2="${pR - 18}" y2="143"/>`;
  out += `<line x1="${pR - 18}" y1="131" x2="${pR - 30}" y2="143"/>`;

  const H = 261, top0 = 175;
  const rowH = Math.min(50, Math.floor(H / rows.length));
  const startY = top0 + Math.max(0, Math.round((H - rows.length * rowH) / 2));
  rows.forEach((r, i) => {
    budget(r.label, hasNote ? 34 : 40, `window label ${i + 1}`);
    const state = r.state || "";
    if (state) budget(state, 14, `window chip ${i + 1}`);
    const t = startY + i * rowH;
    const cy = t + rowH / 2;
    const hl = spec.hl === i;
    if (hl) out += rect(84, t + 6, pw - 28, rowH - 12, { fill: LIME });
    out += txt(96, cy + 4, r.label, { size: 12, weight: hl ? 600 : undefined });
    if (state) {
      const cw = state.length * 6.5 + 20;
      const cx = pR - 24 - cw;
      out += rect(cx, cy - 11, cw, 22, { stroke: hl ? INK : "rgba(19,18,16,.4)", sw: 1.5 });
      out += txt(cx + cw / 2, cy + 3.5, state, { size: 9.5, weight: hl ? 600 : undefined, anchor: "middle" });
    }
    if (spec.meter && hl) {
      // level meter — proof the input is live (mac-mic-input-first)
      const heights = [8, 16, 24, 12, 28, 18, 10];
      const bx = Math.max(96, (state ? pR - 24 - (state.length * 6.5 + 20) : pR - 24) - 78);
      heights.forEach((hh, j) => {
        out += rect(bx + j * 10, cy + 14 - hh, 6, hh, { fill: j === 4 ? LIME : "rgba(19,18,16,.5)" });
      });
    }
  });
  if (hasNote) out += "\n" + noteBox(spec.note);
  return out;
}

function layoutFlow(spec) {
  const nodes = spec.nodes || [];
  if (!nodes.length) throw new Error("flow layout needs nodes[]");
  const n = nodes.length;
  if (n > 4) throw new Error("flow layout supports at most 4 nodes");
  const bw = n === 3 ? 186 : 135;
  const gap = n === 3 ? 51 : 40;
  const xs = nodes.map((_, i) => 70 + i * (bw + gap));
  if (spec.branches && spec.branches.length !== n) throw new Error("flow branches[] must match node count");
  let out = "";
  // optional role tags above each box (FIRST / THEN / AVOID …)
  (spec.branches || []).forEach((b, i) => {
    budget(b, 8, `branch tag ${i + 1}`);
    const w = b.length * 7 + 18;
    const x = xs[i] + bw / 2 - w / 2;
    out += rect(x, 130, w, 20, { stroke: "rgba(19,18,16,.4)", sw: 1.5 });
    out += txt(xs[i] + bw / 2, 144, b.toUpperCase(), { size: 9.5, weight: 600, anchor: "middle" });
  });
  nodes.forEach((nd, i) => {
    budget(nd.k, 18, `flow node tag ${i + 1}`);
    const maxLine = n === 3 ? 18 : 14;
    (nd.l || []).forEach((l, j) => budget(l, maxLine, `flow line ${i + 1}.${j + 1}`));
    const hl = spec.hl === i;
    out += rect(xs[i], 170, bw, 170, { fill: hl ? LIME : PANEL, stroke: INK, sw: 2 });
    out += txt(xs[i] + 16, 198, nd.k.toUpperCase(), { size: 9.5, ls: 1.5, weight: 600 });
    if (nd.l && nd.l[0]) out += txt(xs[i] + 16, 234, nd.l[0], { size: 13, weight: 600 });
    if (nd.l && nd.l[1]) out += txt(xs[i] + 16, 258, nd.l[1], { size: 11, fill: MUTED });
    if (i < n - 1) {
      const x1 = xs[i] + bw + 5, x2 = xs[i + 1] - 5;
      out += line(x1, 255, x2, 255);
      out += arrowHead(x2, 255);
    }
  });
  if (spec.note) out += "\n" + noteStrip(spec.note);
  return out;
}

function layoutVersus(spec) {
  for (const side of ["left", "right"]) {
    const p = spec[side];
    if (!p || !p.title || !Array.isArray(p.lines)) throw new Error(`versus ${side} needs title + lines[]`);
    budget(p.title, 24, `versus ${side} title`);
    if (p.verdict) budget(p.verdict, 16, `versus ${side} verdict`);
    p.lines.forEach((l, i) => budget(l, 28, `versus ${side} line ${i + 1}`));
  }
  let out = "";
  for (const [x, side] of [[70, "left"], [415, "right"]]) {
    const p = spec[side];
    out += rect(x, 140, 315, 290, { fill: PANEL, stroke: INK, sw: 2 });
    out += txt(x + 20, 176, p.title.toUpperCase(), { size: 11, ls: 1, weight: 600 });
    if (p.verdict) {
      const good = p.verdict.trim().startsWith("✓");
      const w = p.verdict.length * 7.5 + 20;
      out += rect(x + 20, 192, w, 26, good ? { fill: LIME } : { stroke: "rgba(19,18,16,.4)", sw: 1.5 });
      out += txt(x + 30, 210, p.verdict, { size: 10.5, weight: 600, fill: good ? INK : MUTED });
    }
    p.lines.forEach((l, i) => {
      const y = 254 + i * 30;
      out += rect(x + 20, y - 9, 7, 7, { fill: "rgba(19,18,16,.5)" });
      out += txt(x + 36, y, l, { size: 12 });
    });
  }
  return out;
}

function layoutDevice(spec) {
  const parts = spec.parts || [];
  if (!parts.length) throw new Error("device layout needs parts[]");
  let out = "";
  for (const p of parts) {
    if (p.t === "slot") {
      const fill = p.state === "hl" ? LIME : p.state === "filled" ? LIGHT : "none";
      out += rect(p.x, p.y, p.w, p.h, { rx: 3, stroke: INK, sw: 2, fill, dash: p.state === "empty" ? "4 3" : undefined });
      if (p.state !== "empty") {
        out += line(p.x + p.w / 2 - 8, p.y + 10, p.x + p.w / 2 + 8, p.y + 10, { stroke: HAIR, sw: 1 });
        out += line(p.x + p.w / 2 - 8, p.y + p.h - 10, p.x + p.w / 2 + 8, p.y + p.h - 10, { stroke: HAIR, sw: 1 });
      }
    } else if (p.t === "fan") {
      out += `<circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${LIGHT}" stroke="${INK}" stroke-width="2"/>`;
      for (const a of [90, 210, 330]) {
        const rad = (a * Math.PI) / 180;
        out += line(p.x + Math.cos(rad) * p.r * 0.75, p.y - Math.sin(rad) * p.r * 0.75, p.x, p.y);
      }
      out += `<circle cx="${p.x}" cy="${p.y}" r="${Math.round(p.r * 0.28)}" fill="${INK}"/>`;
    } else if (p.t === "fin") {
      out += rect(p.x, p.y, p.w, p.h, { stroke: HAIR, sw: 1 });
      for (let hx = p.x + 5; hx < p.x + p.w - 2; hx += 9) {
        out += line(hx, p.y + 4, hx, p.y + p.h - 4, { stroke: "rgba(19,18,16,.35)", sw: 1 });
      }
    } else if (p.t === "drive") {
      out += rect(p.x, p.y, p.w, p.h, { fill: LIGHT, stroke: INK, sw: 2 });
      out += line(p.x + 10, p.y + p.h * 0.45, p.x + p.w - 10, p.y + p.h * 0.45, { stroke: HAIR, sw: 1 });
      out += `<circle cx="${p.x + p.w - 14}" cy="${p.y + 12}" r="3" fill="${LIME}"/>`;
    } else {
      throw new Error(`device layout: unknown part type "${p.t}"`);
    }
  }
  for (const a of spec.arrows || []) {
    out += line(a.x1, a.y1, a.x2, a.y2);
    const dx = Math.sign(a.x2 - a.x1), dy = Math.sign(a.y2 - a.y1);
    out += arrowHead(a.x2 + (dx ? 0 : 0) , a.y2); // head at the end point
    if (a.label) {
      budget(a.label, 8, "arrow label");
      out += txt((a.x1 + a.x2) / 2, Math.min(a.y1, a.y2) - 8, a.label.toUpperCase(), { size: 9.5, fill: MUTED, anchor: "middle" });
    }
  }
  for (const c of spec.callsR || []) {
    const lines = wrap(c.text, 26, 2);
    out += line(540, c.y - 4, 552, c.y - 4, { stroke: HAIR, sw: 1 });
    lines.forEach((l, i) => { out += txt(558, c.y + i * 16, l, { size: 10.5 }); });
  }
  if (spec.note) out += "\n" + noteStrip(spec.note);
  return out;
}

function layoutBars(spec) {
  const rows = spec.rows || [];
  if (!rows.length) throw new Error("bars layout needs rows[]");
  const maxW = Math.max(...rows.map((r) => r.w));
  let out = "";
  rows.forEach((r, i) => {
    budget(r.label, 22, `bar label ${i + 1}`);
    if (r.chip) budget(r.chip, 12, `bar chip ${i + 1}`);
    const y = 190 + i * 58;
    out += txt(70, y + 20, r.label, { size: 12, weight: r.hl ? 600 : undefined });
    const bw = Math.round(380 * (r.w / maxW));
    out += rect(240, y, bw, 30, { fill: r.hl ? LIME : PANEL });
    if (r.chip) {
      const cw = r.chip.length * 7 + 16;
      out += rect(240 + bw + 12, y + 3, cw, 24, { stroke: "rgba(19,18,16,.4)", sw: 1.5 });
      out += txt(240 + bw + 12 + cw / 2, y + 19.5, r.chip, { size: 9.5, weight: 600, anchor: "middle" });
    }
  });
  if (spec.note) out += "\n" + noteStrip(spec.note);
  return out;
}

function layoutKeys(spec) {
  const rows = spec.rows || [];
  if (!rows.length) throw new Error("keys layout needs rows[]");
  let out = "";
  rows.forEach((r, i) => {
    budget(r.desc, 36, `key desc ${i + 1}`);
    (r.keys || []).forEach((k, j) => budget(k, 8, `keycap ${i + 1}.${j + 1}`));
    const y = 190 + i * 54;
    let x = 70;
    for (const k of r.keys) {
      const w = Math.max(30, k.length * 9 + 16);
      out += rect(x, y, w, 32, { rx: 6, fill: spec.hl === i ? LIME : LIGHT, stroke: INK, sw: 1.5 });
      out += txt(x + w / 2, y + 21, k, { size: 11, weight: 600, anchor: "middle" });
      x += w + 8;
    }
    out += txt(x + 10, y + 21, r.desc, { size: 12 });
  });
  return out;
}

const LAYOUTS = { steps: layoutSteps, window: layoutWindow, flow: layoutFlow, versus: layoutVersus, device: layoutDevice, bars: layoutBars, keys: layoutKeys };

/* ---------- Cross-checks (fail fast, never render bad data) ---------- */
function fail(msg) { throw new Error("DIAGRAM DATA FAILED: " + msg); }

const slugToTip = new Map();
for (const t of TIPS) {
  const s = tipSlug(t.title);
  if (slugToTip.has(s)) fail(`duplicate slug "${s}" in tips-data.js`);
  slugToTip.set(s, t);
}

// 1. every spec must target a real tip
for (const slug of Object.keys(SPECS)) {
  if (!slugToTip.has(slug)) fail(`specs.js references unknown tip slug "${slug}"`);
}

// 2. no duplicate figure file names (new specs vs existing wiring)
const seenFiles = new Map();
for (const t of TIPS) {
  if (t.diagram) {
    const f = String(t.diagram).split("/").pop();
    if (seenFiles.has(f)) fail(`duplicate diagram file "${f}"`);
    seenFiles.set(f, "tips-data.js");
  }
}
for (const [slug, spec] of Object.entries(SPECS)) {
  const f = String(spec.file || "").split("/").pop();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*\.svg$/.test(f)) fail(`spec "${slug}": bad file name "${spec.file}"`);
  if (seenFiles.has(f) && seenFiles.get(f) !== "specs.js") {
    // a hand-crafted tip already owns this file — only allowed if it's the same tip
    const owner = slugToTip.get(slug);
    if (!owner || owner.diagram !== `diagrams/${f}`) fail(`spec "${slug}" reuses existing figure file "${f}"`);
  }
  seenFiles.set(f, "specs.js");
}

// 3. canonical wiring: every spec'd tip must point at its spec's file (and vice versa)
const wired = [];
for (const t of TIPS) {
  const slug = tipSlug(t.title);
  if (SPECS[slug]) {
    const expected = `diagrams/${String(SPECS[slug].file).split("/").pop()}`;
    if (t.diagram !== expected) fail(`tip "${slug}" must have diagram: "${expected}" in tips-data.js (found ${JSON.stringify(t.diagram)})`);
    wired.push({ tip: t, slug, spec: SPECS[slug] });
  } else if (t.diagram && seenFiles.get(String(t.diagram).split("/").pop()) === "specs.js") {
    fail(`tip "${slug}" is wired to a generated figure but has no entry in specs.js`);
  }
}
if (!wired.length) fail("no tips are wired to specs — nothing to render");

/* ---------- Render (deterministic: TIPS order, no timestamps) ---------- */
const written = [];
let fig = 24; // hand-crafted figures own FIG. 01–23
for (const { tip, slug, spec } of wired) {
  const layoutFn = LAYOUTS[spec.layout];
  if (!layoutFn) fail(`spec "${slug}": unknown layout "${spec.layout}"`);
  budget(spec.kicker, 16, `kicker for ${slug}`);
  const platform = String(spec.file).startsWith("mac-") ? "MACOS" : "WINDOWS";
  const meta = `${String(tip.time || "").toUpperCase()} · ${LEVELS[tip.difficulty] || ""}`.trim();

  const body = [
    `<rect x="0" y="0" width="800" height="540" fill="${PAPER}"/>`,
    header(fig, platform, spec.kicker, spec.title, meta),
    layoutFn(spec),
    caption(spec.capL),
  ].filter(Boolean).join("\n\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 540" role="img" aria-label="${esc("Schematic diagram: " + spec.title)}">
  <title>${esc((platform === "MACOS" ? "macOS" : "Windows") + " — " + spec.title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&amp;family=Instrument+Serif:ital@1&amp;display=swap');
    .mono { font-family: "IBM Plex Mono", ui-monospace, Consolas, monospace; }
    .serif { font-family: "Instrument Serif", Georgia, serif; font-style: italic; }
  </style>

${body}
</svg>
`;
  const outPath = path.join(ROOT, "diagrams", String(spec.file).split("/").pop());
  writeFileSync(outPath, svg);
  written.push({ slug, file: path.basename(outPath), fig });
  fig += 1;
}

/* ---------- Regenerate diagrams/preview.html (single source of truth) ---------- */
function previewFigMeta(file) {
  // hand-crafted figures carry their FIG number + kicker inside the SVG
  try {
    const raw = readFileSync(path.join(ROOT, "diagrams", file), "utf8");
    const m = raw.match(/FIG\. (\d+) — (WINDOWS|MACOS) · ([A-Z]+)/);
    if (m) return `FIG. ${m[1]} · ${m[3]}`;
  } catch { /* generated files are listed below with their assigned number */ }
  return null;
}

const figByFile = new Map(written.map((w) => [w.file, w.fig]));
const previewRows = [];
for (const t of TIPS) {
  if (!t.diagram) continue;
  const file = String(t.diagram).split("/").pop();
  const slug = tipSlug(t.title);
  let meta = null;
  if (figByFile.has(file)) meta = `FIG. ${String(figByFile.get(file)).padStart(2, "0")} · ${(SPECS[slug] || {}).kicker ? SPECS[slug].kicker.toUpperCase() : ""}`;
  else meta = previewFigMeta(file);
  previewRows.push({ platform: t.cat === "mac" ? "mac" : "win", title: t.title, file, meta });
}

const winFigs = previewRows.filter((r) => r.platform === "win");
const macFigs = previewRows.filter((r) => r.platform === "mac");
const figBlock = (r) => `  <figure><img src="${esc(r.file)}" alt="" width="800" height="540"><figcaption><span class="tip">${esc(r.title)}</span>${r.meta ? `<span class="meta">${esc(r.meta)}</span>` : ""}</figcaption></figure>`;

const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>EmTech Media — Diagram preview</title>
<style>
  :root { --paper: #f1eee6; --ink: #131210; --muted: #5f5b50; --hairline: rgba(19,18,16,.18); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--paper); color: var(--ink); font-family: "IBM Plex Mono", ui-monospace, Consolas, monospace; padding: 48px 24px 96px; }
  .wrap { max-width: 900px; margin: 0 auto; }
  header { margin-bottom: 40px; border-bottom: 1px solid var(--ink); padding-bottom: 20px; }
  .kicker { font-size: 11px; letter-spacing: 2px; color: var(--muted); margin-bottom: 8px; }
  h1 { font-family: "Instrument Serif", Georgia, serif; font-style: italic; font-weight: 400; font-size: clamp(28px, 5vw, 40px); }
  .note { margin-top: 10px; font-size: 12px; color: var(--muted); }
  h2 { font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 56px 0 20px; padding-bottom: 8px; border-bottom: 1px solid var(--hairline); color: var(--muted); }
  figure { margin: 0 0 40px; }
  figcaption { display: flex; justify-content: space-between; gap: 16px; padding-top: 10px; font-size: 12px; }
  figcaption .tip { color: var(--ink); }
  figcaption .meta { color: var(--muted); white-space: nowrap; }
  img { display: block; width: 100%; height: auto; border: 1px solid var(--hairline); background: var(--paper); }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <p class="kicker">EMTECH MEDIA · WORKING PREVIEW — NOT PART OF THE SITE</p>
    <h1>All ${previewRows.length} figures, in one place</h1>
    <p class="note">Each figure appears inside its tip's accordion and on its static fix page. Order below matches windows.html then mac.html. Regenerated by build/diagrams.mjs — do not edit by hand.</p>
  </header>

  <h2>Windows page — ${winFigs.length} figures</h2>

${winFigs.map(figBlock).join("\n")}

  <h2>Mac page — ${macFigs.length} figures</h2>

${macFigs.map(figBlock).join("\n")}
</div>
</body>
</html>
`;
writeFileSync(path.join(ROOT, "diagrams", "preview.html"), previewHtml);

/* ---------- Summary ---------- */
console.log(`diagrams: rendered ${written.length} figures (FIG. 24–${String(fig - 1).padStart(2, "0")})`);
for (const w of written) console.log(`  FIG. ${String(w.fig).padStart(2, "0")}  diagrams/${w.file}   ← ${w.slug}`);
console.log(`preview: diagrams/preview.html regenerated (${winFigs.length} Windows + ${macFigs.length} Mac figures)`);
