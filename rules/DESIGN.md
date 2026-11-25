# DESIGN.md: Fauzan Taufiq Portfolio (`fauzantaufiq.id`)

## 1\. Identity \& Design Read

* **Project:** Personal Portfolio \& Case Study Showcase for Muhammad Fauzan Taufiq (Digital Creative Specialist \& Social Media Strategist).
* **Audience:** Hiring managers, creative directors, brand managers, and prospective freelance clients.
* **Visual Language:** Editorial precision with high-contrast monochrome structure, Apple-inspired typographic discipline, and a single terracotta accent.
* **Theme Lock:** Light mode is permanently locked as the primary canvas (`#f5f5f7` and `#ffffff`), punctuated by deliberate dark sections (`#1d1d1f` and `#000000`) to prevent visual monotony. Do not build a light/dark theme switcher.
* **Dial:** `ENERGY 2 / RHYTHM 3 / MOTION 2`

  * **ENERGY 2 (Balanced):** Confident editorial presence without loud gradients, neon glows, or visual clutter.
  * **RHYTHM 3 (Asymmetric \& Varied):** Sections must visibly alternate in composition, grid ratio, and surface polarity (light canvas vs. dark accent blocks). Never stack identical centered card grids consecutively.
  * **MOTION 2 (Purposeful Scroll-Reveal):** Subtle, hardware-accelerated scroll-reveal transitions (`opacity` and `translateY` within `16px-24px`, `cubic-bezier(0.22, 1, 0.36, 1)`) plus crisp hover states. Respect `prefers-reduced-motion`.

## 2\. Color Tokens \& Contrast Rules

### Core \& Accent Palette

|Token|Hex|Role \& Strict Usage Rules|
|-|-|-|
|`--color-accent-primary`|`#b54f26`|**Terracotta Primary:** Filled primary CTA buttons (with `#ffffff` text), active filter states, and key focal indicators.|
|`--color-accent-hover`|`#963f1c`|**Terracotta Deep:** Hover and active press state for primary buttons.|
|`--color-canvas-light`|`#f5f5f7`|**Primary Canvas:** Main page background (Apple Frost neutral).|
|`--color-surface-white`|`#ffffff`|**Elevated Surface:** Clean editorial blocks, case study containers, and modal surfaces on light sections.|
|`--color-surface-subtle`|`#e8e8ed`|**Subtle Fill:** Secondary pill button fills and tag backgrounds on light surfaces.|
|`--color-ink-primary`|`#1d1d1f`|**Primary Ink:** Headlines, primary body copy, and strong structural borders on light surfaces.|
|`--color-ink-secondary`|`#474747`|**Secondary Ink:** Subheadings, role metadata, and supporting descriptions on light surfaces.|
|`--color-ink-muted`|`#595959`|**Muted Ink:** Captions, timestamps, and footer metadata (calibrated to maintain >6.0:1 contrast on `#f5f5f7`).|
|`--color-border-hairline`|`#d2d2d7`|**Light Hairline:** 1px structural dividers on light surfaces.|
|`--color-surface-dark`|`#1d1d1f`|**Dark Accent Section:** Alternating high-contrast showcase sections (e.g., Featured Campaign Spotlight or Contact Footer).|
|`--color-surface-black`|`#000000`|**True Onyx:** Deep contrast framing for visual artifacts and brand monogram lockups.|
|`--color-ink-on-dark`|`#f5f5f7`|**Dark Section Primary Text:** Headlines and body copy inside dark sections.|
|`--color-ink-on-dark-muted`|`#a1a1a6`|**Dark Section Secondary Text:** Metadata and secondary copy inside dark sections.|
|`--color-border-dark`|`#333333`|**Dark Hairline:** 1px structural dividers inside dark sections.|

### Accessibility Contrast Guardrails

* All normal text (<18px) must maintain at least a **4.5:1** contrast ratio; large text (18px+) at least **3.0:1**.
* **Critical Dark Section Rule:** Inside `#1d1d1f` or `#000000` sections, never use `#b54f26` for small body text or thin text links (contrast is below 4.5:1). Use `#b54f26` strictly as a filled button background with `#ffffff` text (5.11:1 ratio) or as a non-text accent border.
* Text overlaid on photography or campaign visuals must sit behind a solid dark scrim (`rgba(0, 0, 0, 0.65)`) or within an adjacent solid container.

## 3\. Typography System

### Font Stack

* `--font-display`: `"Bricolage Grotesque", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` (expressive editorial grotesque for H1, H2, H3, `.hero-heading`, and `.section-heading`).
* `--font-text`: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Public Sans", "Segoe UI", Roboto, sans-serif` (OS-aware stack that renders native Apple SF Pro Text on iOS/iPadOS/macOS and Public Sans on Windows/Android/Linux).

### Type Scale \& Tracking Discipline

* **Hero Display (`--text-display`):** `clamp(36px, 5vw, 56px)`, line-height `1.05`, weight `800`, letter-spacing `-0.025em`.
* **Hero Role Kicker (`.hero-role`):** `15px`, line-height `1.35`, weight `600`, color `#b54f26`, letter-spacing `0em`, paired with a subtle structural horizontal rule (never an AI capsule pill badge).
* **Section Heading (`--text-heading`):** `clamp(28px, 3.5vw, 40px)`, line-height `1.14`, weight `600`, letter-spacing `-0.02em`.
* **Case Study Title (`--text-heading-sm`):** `clamp(22px, 2.5vw, 28px)`, line-height `1.18`, weight `600`, letter-spacing `-0.015em`.
* **Editorial Lead / Subhead (`--text-subheading`):** `21px`, line-height `1.32`, weight `400`, letter-spacing `-0.005em`.
* **Body Copy (`--text-body`):** `17px`, line-height `1.5`, weight `400`, letter-spacing `0em`.
* **Metadata / UI Controls (`--text-body-sm`):** `14px`, line-height `1.35`, weight `500`, letter-spacing `0em`.
* **Caption / Micro-label (`--text-caption`):** `12px`, line-height `1.33`, weight `500`, letter-spacing `0.02em` (sentence case or clean title case; avoid wide-tracked ALL CAPS labels).

## 4\. Layout Architecture \& Asymmetric Rhythm

### Spatial Rules

* **Container Max-Width:** `1280px` for asymmetric editorial grids; `100%` full-bleed for dark accent bands.
* **Section Vertical Rhythm:** Minimum `80px` to `112px` vertical padding between major sections on desktop (`56px` on mobile).
* **Elevation Philosophy:** Flat, architectural hierarchy built via surface contrast (`#f5f5f7` vs `#ffffff` vs `#1d1d1f`) and `1px` hairline borders (`#d2d2d7` / `#333333`). Avoid heavy drop shadows on cards or buttons.
* **Border Radius Discipline:**

  * Primary \& Secondary Action Buttons, Filter Pills: `980px` (full capsule, echoing the bold rounded geometry of the `FT` monogram).
  * Case Study Media Frames, Containers, Form Inputs: `12px` (controlled architectural rounding).

### Section-by-Section Rhythm Map (RHYTHM 3)

1. **Top Navigation (Dynamic Expanded to Floating Liquid Glass):** At the top of the page (`scrollY <= 24`), full-width `#f5f5f7` bar with `1px` `#d2d2d7` bottom border and `18px 0` padding. When scrolled (`scrollY > 24`), transitions smoothly (`280ms cubic-bezier(0.22, 1, 0.36, 1)`) into a compact floating Liquid Glass capsule (`top: 12px`, `width: min(92%, 1120px)`, `980px` radius, `rgba(245, 245, 247, 0.74)`, `blur(20px) saturate(180%)`). Left: local `FT` monogram. Center/Right: 4 links (`About`, `Experience`, `Work`, `Contact`) plus `Download Resume` CTA.
2. **Hero Section (Light `#f5f5f7`, Asymmetric 7:5 Split):** Left column (7 cols): `.hero-role` kicker in `#b54f26` with left rule, bold value proposition H1 (`weight 800`, `-0.025em`), positioning paragraph (`17px`), and paired CTAs (one filled `#b54f26` pill + one outlined `#1d1d1f` pill). Right column (5 cols): clean edge-to-edge editorial portrait frame (`12px` radius) with no footer caption strip. On mobile (`<= 768px`), reorders so portrait sits between bio and side-by-side CTA buttons.
3. **Featured Impact Spotlight (Dark Accent Section `#1d1d1f` Full-Bleed):** High-contrast band highlighting flagship campaigns (Wellfest 2025, BPOM RI, HAI FEST 2025). Asymmetric two-column split: sticky narrative \& verified metrics on the left (`35%`), staggered natural-aspect visual showcase on the right (`65%`).
4. **Curated Client \& Experimental Work (Light `#ffffff` Surface):** Asymmetric archive pairing 4:8 client showcase carousels (`Open Gallery` + circular prev/next arrows) with 7:5 / 5:7 experimental visual identity cards.
5. **Experience \& Capabilities (Light `#f5f5f7` Surface, Editorial Index Layout):** Two-column asymmetric layout (`4:8` ratio). Left column: sticky section title and core toolset grouped cleanly without progress bars. Right column: chronological experience list separated by `1px` `#d2d2d7` hairline rules (no boxed cards), followed by university education entries.
6. **Contact \& Footer (Dark Accent Section `#000000` Full-Bleed):** Direct collaboration prompt on the left, functional contact form (`12px` radius inputs with `#b54f26` focus ring and right-aligned submit CTA) on the right, and a single-row legal footer below a `1px` `#333333` divider (centered on mobile).

## 5\. Component Specifications

* **Primary Button:** `border-radius: 980px`, `background: #b54f26`, `color: #ffffff`, `padding: 12px 22px`, `font-size: 15px`, `font-weight: 500`, minimum height `44px` for mobile tap targets.
* **Secondary Button:** `border-radius: 980px`, `background: transparent`, `border: 1px solid #1d1d1f` (or `#f5f5f7` on dark sections), `padding: 12px 22px`, minimum height `44px`.
* **Keyboard Focus Indicator:** Every interactive element must display a visible `:focus-visible` ring (`2px solid #b54f26`, `outline-offset: 3px`). Never remove focus outlines without this replacement.

