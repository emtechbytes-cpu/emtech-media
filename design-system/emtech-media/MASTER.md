# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** EmTech Media
**Category:** Editorial / technical how-to library
**Source of truth:** `style.css` — this file documents what ships. If the two
disagree, `style.css` wins and this file is stale.
**Last reconciled with code:** 2026-08-18

> **Note:** this file previously described a generated pink/cyan Inter system with
> glassmorphism, GSAP and a video hero. None of that was ever built. It has been
> rewritten from the tokens actually in `style.css`.

---

## Global Rules

### Color Palette

Semantic, not literal — `--ink` is "the foreground" and `--paper` is "the surface",
so the whole system inverts by swapping two variables. Never hardcode a hex in a
component; always reach for the token.

| Role | Light (`:root`) | Dark (`[data-theme="dark"]`) | CSS Variable |
|------|-----------------|------------------------------|--------------|
| Surface | `#f1eee6` | `#131210` | `--paper` |
| Raised surface | `#e9e5d8` | `#1e1d18` | `--paper-2` |
| Foreground | `#131210` | `#f1eee6` | `--ink` |
| Muted text | `#5f5b50` | `#a49f90` | `--muted` |
| Accent | `#c8f03c` | `#c8f03c` *(unchanged)* | `--accent` |
| Text on accent | `#131210` | `#131210` *(unchanged)* | `--on-accent` |
| Muted on inverted | `rgba(241,238,230,.75)` | `rgba(19,18,16,.7)` | `--on-ink-muted` |
| Hairline | `rgba(19,18,16,.18)` | `rgba(241,238,230,.2)` | `--hairline` |
| Error | `#d93a2b` | `#d93a2b` | `--error` |

**Notes:** The lime accent and its text colour deliberately do **not** flip between
themes — lime is legible against dark text in both, and flipping it broke the
ticker and button hovers. Dark mode also sets `color-scheme: dark` so form
controls and scrollbars follow.

**Theme switching:** `data-theme` on `<html>`, written pre-paint by an inline
script in each page's `<head>` (avoids a flash of the wrong theme), persisted to
`localStorage` under `emtech-theme`, and mirrored into
`<meta name="theme-color" id="meta-theme-color">` so the mobile browser chrome
matches. Any new page must copy that inline script block verbatim.

### Typography

Four families, each with one job. Do not introduce a fifth.

| Token | Family | Used for |
|-------|--------|----------|
| `--font-display` | Bricolage Grotesque | All headings (`h1`–`h3`), buttons |
| `--font-body` | Inter | Body copy, descriptions |
| `--font-mono` | IBM Plex Mono | Kickers, section numbers, tags, metadata, `.btn-link` |
| `--font-serif` | Instrument Serif *(italic only)* | The `.serif` accent phrase in a headline |

**Google Fonts:**
```
https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@1&family=Inter:wght@400;500&display=swap
```

**Headings** (`h1, h2, h3`): `--font-display`, `font-weight: 700`,
`line-height: 1.02`, `letter-spacing: -0.035em`. Tight and large — that ratio is
the whole look, don't loosen it.

**Body:** 16px base, `line-height: 1.6`, `-webkit-font-smoothing: antialiased`.

**Type scale** — fluid via `clamp()`, never fixed:

| Element | Size |
|---------|------|
| Hero `h1` | `clamp(2.9rem, 8.4vw, 7rem)` |
| Section `h2` | `clamp(2.2rem, 5vw, 3.9rem)` |
| Index row title | `clamp(1.4rem, 3vw, 2.3rem)` |
| Diagnosis title | `clamp(1.5rem, 3vw, 2.2rem)` |
| Lede | `clamp(1.05rem, 1.5vw, 1.2rem)` |
| Kicker / section number | `0.8rem`, uppercase, `letter-spacing: 0.16em` |

**Measure:** cap running text — `.lede` at `52ch`, `.sec-sub` at `56ch`,
`.diag-title` at `34ch`.

### Layout

- `--container: 1240px`, applied as `width: min(100% - 48px, var(--container))`
  — the gutter is baked into the container, so never add page padding around it.
  Drops to `100% - 28px` below 360px.
- `--header-h: 76px`. Sections carry `scroll-margin-top: calc(var(--header-h) + 16px)`
  so anchor links don't hide under the sticky header.
- Section rhythm: `padding: clamp(72px, 10vw, 130px) 0` with a
  `1px solid var(--hairline)` top border. Section headers get
  `margin-bottom: clamp(40px, 6vw, 72px)`.
- **Breakpoints:** 980px, 760px, 560px, 360px. Use these four; don't invent more.

### Borders and Dividers

There are no rounded corners and no shadows anywhere in this system. Structure is
communicated with 1px lines only:

- `1px solid var(--ink)` — the outer edge of a component (grid, card, button)
- `1px solid var(--hairline)` — dividers *inside* a component, and between list rows

**Draw interior dividers as borders on the child elements, never as a gap-and-
background-bleed trick.** A grid using `gap: 1px` over a coloured container
background will show that background as a solid slab wherever the final row is
incomplete. Cells own their own right/bottom hairline, trimmed at the trailing
edge per breakpoint.

---

## Component Specs

### Buttons

```css
/* Base — square, bordered, display font */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 12px 26px;
  border: 1px solid var(--ink);
  background: transparent;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

/* Primary — solid ink, goes lime on hover */
.btn-primary { background: var(--ink); color: var(--paper); }
.btn-primary:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
  transform: translateY(-2px);
}

/* Tertiary — mono, uppercase, underlined; for "browse all" style links */
.btn-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.btn-link:hover { background: var(--accent); color: var(--on-accent); }
```

Every interactive element clears a 44px minimum touch target.

### Focus

```css
:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
```

Because the offset is positive, **never put `overflow: hidden` on a container
whose children are focusable** — it clips the ring.

### Cards and Rows

Cards are square-cornered, `1px solid var(--ink)`, `background: var(--paper)`,
hovering to `var(--paper-2)`. Selected/pressed state inverts to
`background: var(--ink); color: var(--paper)`, with muted text inside switching
to `var(--on-ink-muted)`.

List rows (`.index-list`, `.acc-item`) are separated by
`border-top: 1px solid var(--hairline)` on `li + li` — no card chrome at all.

---

## Motion

One easing curve, one philosophy: things rise and fade, nothing bounces.

**Easing:** `cubic-bezier(0.22, 1, 0.36, 1)` — the only curve in the system, used
for every non-trivial transition. Plain `ease` is acceptable for simple colour
changes.

**Durations:** `0.15s`/`0.2s` for hover colour, `0.25s` for transforms, `0.45s`
for panel entrances, `0.5s` for scroll reveals, `0.9s` for the hero line-rise.

**Patterns:**
- *Scroll reveal* — `.reveal` starts at `opacity: 0; translateY(14px)`, gains
  `.in-view` from an IntersectionObserver. Stagger with `.delay-1` … `.delay-5`
  (70ms steps).
- *Hero line-rise* — each headline line sits in an `overflow: hidden` mask and
  animates `translateY(110%) → 0`, second line delayed 120ms.
- *Panel entrance* — `rise-in`, opacity + 10px, 0.45s.

**Reduced motion:** a global `@media (prefers-reduced-motion: reduce)` block
collapses all animation and transition durations to `0.01ms` and forces
`.reveal` visible. Any new animation must survive that override — never make
content *only* reachable through a transition.

---

## Anti-Patterns (Do NOT Use)

- ❌ **Rounded corners or box-shadows** — this system is flat and square. Depth
  comes from inversion (ink on paper) and 1px rules, nothing else.
- ❌ **Hardcoded hex values in components** — always use the tokens, or the page
  breaks in dark mode.
- ❌ **Flipping `--accent` or `--on-accent` per theme** — lime stays lime.
- ❌ **Gap-bleed grid dividers** — see *Borders and Dividers* above.
- ❌ **A fifth font family**, or a heading in anything but `--font-display`.
- ❌ **Emojis as icons** — inline SVG with `stroke="currentColor"`,
  `stroke-width="1.8"`, `stroke-linecap="round"`, marked `aria-hidden="true"`.
- ❌ **`overflow: hidden` around focusable children** — clips the focus ring.
- ❌ **Absolute URLs to a domain that isn't registered** — no canonical/og:url
  until the real host exists.
- ❌ **Placeholder `href="#"` links** — ship a real destination or no link.

---

## Pre-Delivery Checklist

- [ ] All colours come from tokens; page renders correctly in **both** themes
- [ ] Inline pre-paint theme script present in `<head>`, `meta-theme-color` updated
- [ ] Headings use `--font-display`; no fifth family introduced
- [ ] No rounded corners, no shadows
- [ ] Interior dividers drawn on children, and an incomplete final grid row leaves no slab
- [ ] Focus states visible; no `overflow: hidden` clipping them
- [ ] Text contrast ≥ 4.5:1 in both themes
- [ ] `prefers-reduced-motion` respected by any new animation
- [ ] No horizontal scroll at 320, 360, 390, 414, 768, 1024, 1440
- [ ] Anchor targets clear the sticky header (`scroll-margin-top`)
- [ ] Every `<img>` has `alt`; decorative ones `alt="" aria-hidden="true"`
- [ ] One `<h1>` per page; heading levels not skipped
- [ ] No dead `href="#"` links, no unregistered-domain URLs
