# DESIGN.md: Fauzan Taufiq Portfolio (`fauzantaufiq.id`)

## 1. Identity & Design Read

- Project: Personal portfolio, campaign archive, and authenticated CMS workspace for Muhammad Fauzan Taufiq (Digital Creative Specialist & Social Media Strategist).
- Audience: Hiring managers, creative directors, brand managers, and freelance clients.
- Visual Language: Editorial precision with high-contrast monochrome structure, disciplined grotesque-and-neo-grotesque typography, and a single terracotta accent.
- Theme Lock: Light mode is permanently locked as the primary canvas (`#f5f5f7` and `#ffffff`), punctuated by deliberate dark sections (`#1d1d1f` and `#000000`) and unified `#1d1d1f` studio/admin chrome. Do not build a light/dark theme switcher.
- Dial: `ENERGY 3 / RHYTHM 3 / MOTION 2` (public showcase) and `ENERGY 1 / RHYTHM 1 / MOTION 1` (admin workspace).
  - ENERGY 3 (Public) / ENERGY 1 (Admin): Studio terracotta-to-charcoal hero statement on entry for the portfolio, paired with calm, utilitarian surfaces inside `/admin`.
  - RHYTHM 3 (Asymmetric & Varied): Public sections alternate in surface polarity (`#b54f26 -> #1d1d1f` studio hero, `#1d1d1f` spotlight, `#ffffff` archive, `#f5f5f7` experience index, `#000000` contact) and grid ratios (`7:5`, `35:65`, `4:8`, `7:5 / 5:7`, `5:7`).
  - MOTION 2 (Purposeful Scroll-Reveal & Tactile Hover): Hardware-accelerated scroll reveals (`opacity` and `translateY(20px)`, `540ms cubic-bezier(0.22, 1, 0.36, 1)`), subtle hero CTA elevation (`translateY(-4px) scale(1.04)` under `any-hover: hover`), and `prefers-reduced-motion` overrides.

## 2. Color Tokens & Contrast Rules

### Core & Accent Palette

| Token | Hex | Role & Strict Usage Rules |
| --- | --- | --- |
| `--color-accent-primary` | `#b54f26` | Terracotta primary fill for CTAs (`#ffffff` text, `5.11:1`), studio hero focal light, active filter/tab states, and focus rings (`5.11:1` on `#ffffff`). |
| `--color-accent-hover` | `#963f1c` | Deep terracotta hover/active state (`6.94:1` on `#ffffff`) and city-search match text highlight (`6.38:1` on `#f5f5f7`). |
| `--color-canvas-light` | `#f5f5f7` | Primary page background on public index and admin workspace. |
| `--color-surface-white` | `#ffffff` | Elevated cards, featured experience rows, tables, and light modal surfaces. |
| `--color-surface-subtle` | `#e8e8ed` | Secondary pill fills and subtle hover backgrounds on light surfaces. |
| `--color-ink-primary` | `#1d1d1f` | Headlines, body copy, and primary hover borders on light surfaces (`16.97:1` on `#ffffff`). |
| `--color-ink-secondary` | `#474747` | Subheadings, metadata, and supporting copy on light surfaces (`9.35:1` on `#ffffff`). |
| `--color-ink-muted` | `#595959` | Captions and form hints on light surfaces (`6.38:1` on `#f5f5f7`). |
| `--color-border-hairline` | `#d2d2d7` | `1px` architectural section and row dividers on light surfaces. |
| `--color-border-control-light` | `#76767b` | Form input, pill, and icon-button borders on light surfaces (`4.54:1` on `#ffffff`, passing WCAG 1.4.11 `3:1`). |
| `--color-surface-dark` | `#1d1d1f` | Featured Spotlight section, lightbox modal surface, and admin sticky topbar. |
| `--color-surface-dark-elevated` | `#2c2c2e` | Interactive pills and subtle buttons inside the `#1d1d1f` admin topbar. |
| `--color-surface-black` | `#000000` | Contact & Footer band and lightbox media stage. |
| `--color-ink-on-dark` | `#f5f5f7` | Primary headlines and body copy inside `#1d1d1f` and `#000000` surfaces (`15.58:1` on `#1d1d1f`). |
| `--color-ink-on-dark-muted` | `#a1a1a6` | Secondary metadata and captions inside dark sections (`6.76:1` on `#1d1d1f`). |
| `--color-border-dark` | `#333333` | `1px` structural dividers inside `#1d1d1f` and `#000000` sections. |
| `--color-border-control-dark` | `#6e6e73` | Interactive button and input borders inside `#1d1d1f` dark sections and modals (`3.32:1` on `#1d1d1f`, passing WCAG 1.4.11 `3:1`). |

### Accessibility Contrast Guardrails

- Normal text (`< 18px`) maintains at least `4.5:1` contrast; large text (`>= 18px`) and interactive component boundaries maintain at least `3.0:1`.
- Inside `#1d1d1f` or `#000000` sections, never use `#b54f26` for body text or inline links. Use `#b54f26` only as a filled button/chip surface with `#ffffff` text (`5.11:1`) or as a focus indicator where contrast clears `3:1`.
- Over the terracotta hero (`#b54f26 -> #963f1c -> #5e2611 -> #1d1d1f`), copy uses `#ffffff` (`>= 5.11:1`) and `#f5f5f7` (`>= 4.68:1`), `:focus-visible` uses `#ffffff`, the primary CTA inverts to `#ffffff` fill with `#1d1d1f` ink (`16.83:1`), and the mobile `Menu` toggle border uses `rgba(255, 255, 255, 0.88)` (`4.33:1`).
- Text overlaid on campaign photography sits inside a solid dark scrim (`rgba(0, 0, 0, 0.65)`).

## 3. Typography System

- `--font-display`: `"Bricolage Grotesque", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` for `h1`, `h2`, `h3`, `.hero-heading`, `.section-heading`, and metric numerals.
- `--font-text`: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Public Sans", "Segoe UI", Roboto, sans-serif` (renders native SF Pro Text on Apple devices and Public Sans on Windows, Android, and Linux).
- Scale (fluid `rem` / `clamp()` so 200% browser text zoom never clips):
  - `--text-display`: `clamp(2.25rem, 5vw, 3.5rem)`, line-height `1.05`, weight `800`, tracking `-0.025em`.
  - `.hero-role`: `0.9375rem` (`15px`), line-height `1.35`, weight `600`, `#ffffff` on the studio hero with a `1.75rem x 2px` horizontal rule (`0.9` opacity `#ffffff`), avoiding capsule eyebrow pills.
  - `--text-heading`: `clamp(1.75rem, 3.5vw, 2.5rem)`, line-height `1.14`, weight `600`, tracking `-0.02em`.
  - `--text-heading-sm`: `clamp(1.375rem, 2.5vw, 1.75rem)`, line-height `1.18`, weight `600`, tracking `-0.015em`.
  - `--text-subheading`: `clamp(1.125rem, 1.6vw, 1.3125rem)`, line-height `1.32`, weight `400`, tracking `-0.005em`.
  - `--text-body`: `1.0625rem` (`17px`), line-height `1.5`, weight `400`.
  - `--text-body-sm`: `0.875rem` (`14px`), line-height `1.35`, weight `500`.
  - `--text-caption`: `0.75rem` (`12px`), line-height `1.33`, weight `500`, tracking `0.02em` (sentence or title case, never wide-tracked ALL CAPS).

## 4. Layout Architecture & Section Rhythm

1. **Adaptive Navigation (`.site-header`):** Fixed transparent at `top: 0` when `scrollY <= 24` over the studio hero (white FT monogram `/images/logo-white.svg`, `#ffffff` links ordered `About, Work, Experience, Contact`, and inverted `#ffffff` `See Resume` CTA). On scroll (`scrollY > 24`), transitions (`280ms cubic-bezier(0.22, 1, 0.36, 1)`) into the single floating Liquid Glass capsule (`top: 12px`, `width: min(92%, 1120px)`, `980px` radius, `rgba(245, 245, 247, 0.78)` with `blur(20px) saturate(180%)`), switching to `/images/logo-original.svg`, `#1d1d1f` links, and `#b54f26` CTA fill.
2. **Hero Section (`#about`, `.hero-section--studio`):** Terracotta-dominant radial studio backdrop (`#b54f26 -> #963f1c -> #5e2611 -> #1d1d1f`, centered at `72% 56%` on desktop/tablet and `50% 58%` on mobile) radiating behind the frameless `43.3 KB` WebP cutout portrait (`/images/profile-fauzan-cutout.webp`). Uses a 2-row `7:5` grid on desktop (`>= 1024px`, `max-height: clamp(380px, 42vw, 540px)`), a balanced `1.15fr / 0.85fr` 2-column grid on tablet (`769px` to `1023px`, `max-height: 400px`), and a single-column mobile stack (`<= 768px`, `max-height: 360px` centered above side-by-side CTAs).
3. **Featured Campaign Spotlight (`#work`, `#1d1d1f`):** Full-bleed dark band rendering any CMS section promoted to `layout === "spotlight"` (plus legacy `brandoctors*` slider rows unless set to `grid`) ordered by `sort_order`. Uses a `35:65` split with sticky narrative and optional highlight metrics on the left and natural-aspect visual artifacts on the right.
4. **Curated Client & Visual Studies Archive (`#archive`, `#ffffff`):** Pairs `4:8` client carousels (`Open Gallery` + `44px` circular prev/next buttons) with `7:5` and `5:7` asymmetric experimental study cards.
5. **Experience & Education (`#experience`, `#f5f5f7`):** `4:8` editorial index with sticky Core Creative Software (`images/icons/*` local SVGs and WebP) and Strategic & Production Capabilities tags on the left. On the right, Work Experience highlights active or featured roles inside elevated `#ffffff` cards (`.ledger-row--featured`, `12px` radius, `1px solid #d2d2d7`) with terracotta status chips (`Current Role` / `Featured`), followed by the `"Education"` group covering both university and high school records, with no trailing divider rule on the final row (`.ledger-row:last-child`).
6. **Contact & Footer (`#contact`, `#000000`):** `5:7` split pairing direct email/WhatsApp cards and `44px` circular social icon buttons with the validated inquiry form (`12px` inputs, honeypot field, right-aligned submit button) above a single-row legal footer (`Terms of Service`, `Privacy Policy`).
7. **Admin Workspace Chrome (`admin.html`, `css/admin.css`):** Unifies authentication and navigation with the public dark palette via a `#1d1d1f` + terracotta radial login screen (`#963f1c -> #4d1f0e -> #1d1d1f` behind a `#ffffff` auth card) and a sticky `#1d1d1f` topbar (`/images/logo-white.svg`, `#2c2c2e` pills/buttons), paired with high-readability `#f5f5f7` / `#ffffff` CRUD tables, modals, rich-text editor, worldwide sharded city combobox, and live `/api/analytics` telemetry cards (`>= 44x44px` tap targets throughout).

## 5. Major Visual Decisions & Purpose Statements (R-31)

| Element / Technique | One-Line Purpose Statement |
| --- | --- |
| Terracotta radial studio hero (`#b54f26 -> #1d1d1f`) | Concentrates studio warmth behind the frameless cutout portrait to create a single entry focal point while keeping `>= 4.68:1` copy contrast (R-01). |
| Floating Liquid Glass navbar on scroll (`R-10`) | Separates persistent navigation from scrolling light and dark bands without occupying a full-width opaque banner, capped to one surface (R-10). |
| `Bricolage Grotesque` + `SF Pro Text` / `Public Sans` | Pairs expressive editorial display headlines with native-grade UI legibility across Apple, Windows, and Android screens (R-06). |
| Alternating surface polarity (`Hero -> #1d1d1f -> #ffffff -> #f5f5f7 -> #000000`) | Marks transitions between flagship campaigns, archive work, credentials, and contact without relying on decorative dividers or card shadows (R-05, R-12). |
| Dual border-radius scale (`980px` actions, `12px` containers/inputs, `6px` metadata chips) | Distinguishes clickable action pills from static metadata tags and structural frames at a glance (R-11). |
| Elevated `#ffffff` `.ledger-row--featured` card + terracotta chip | Highlights current or flagship roles inside the chronological `#f5f5f7` ledger without adding decorative left-edge stripes (R-14, R-31). |
| Self-hosted `/images/icons/*` SVGs & WebP | Displays recognizable creative tool marks at `18px` while keeping `img-src` locked to `'self'` and Supabase Storage (R-04). |
| Unified `#1d1d1f` Admin login & topbar with `#f5f5f7` / `#ffffff` workspace | Connects `/admin` visually to the public brand chrome while keeping dense forms, tables, and telemetry cards comfortable to scan and edit (R-20, C-3). |
