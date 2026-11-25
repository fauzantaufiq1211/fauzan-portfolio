# Fauzan Taufiq Portfolio (`fauzantaufiq.id`)

Personal portfolio and admin workspace for Muhammad Fauzan Taufiq, Digital Creative Specialist and Social Media Strategist.

Live site: [https://fauzantaufiq.id](https://fauzantaufiq.id)

## Architecture

- **Markup:** Semantic HTML5 (`index.html` public showcase and `admin.html` workspace) using native `<dialog>` modals.
- **Styling:** Modular CSS3 (`css/tokens.css`, `css/reset.css`, `css/layout.css`, `css/components.css`, `css/admin.css`) with zero CSS framework runtime dependency.
- **Scripts:** Modular Vanilla JavaScript ES Modules (`js/public/`, `js/admin/`, `js/config/`, `js/utils/`) importing a local `esbuild`-bundled `@supabase/supabase-js` client (`js/vendor/supabase-js.js`).
- **Typography:** `Bricolage Grotesque` for display headings alongside an OS-aware text stack (`SF Pro Text` on Apple platforms and `Public Sans` elsewhere).
- **Static Assets & Security:** Brand logos (`images/logo-original.svg`, `images/logo-white.svg`), WebP portrait (`images/profile-fauzan.webp`), and resume PDF (`files/cv-fauzan-taufiq.pdf`) served from local static routes under Vercel security and caching headers configured in `vercel.json`.

## Supabase Schema

Content and inquiries are managed through six PostgreSQL tables plus the `portfolio-images` Storage bucket:

| Table | Purpose |
| --- | --- |
| `portfolio_sections` | Campaign spotlight and client archive group headers and ordering |
| `portfolio_items` | Visual deliverables, captions, and WebP artwork URLs linked by `section_id` |
| `experience` | Work history entries with optional `is_featured` highlighting |
| `education` | Academic credentials rendered in the background ledger |
| `competencies` | Software tools and capability groupings |
| `messages` | Inquiries submitted from the public contact form |

## Local Development & Build

1. Install dependencies:
   ```bash
   npm install
   ```
2. Regenerate the vendored Supabase ES module bundle when updating `@supabase/supabase-js`:
   ```bash
   npm run vendor
   ```
3. Build minified production HTML, CSS, JS, and copied static assets into `dist/`:
   ```bash
   npm run build
   ```
4. Preview the compiled production output locally:
   ```bash
   npx serve dist
   ```

## Admin Workspace

Open `/admin` (rewritten to `admin.html` via `vercel.json`) to sign in with an allowlisted Supabase Auth administrator account via password or Magic Link and manage overview metrics, inquiry inbox state, portfolio WebP uploads, and profile records.

## Contact

- Email: [contact@fauzantaufiq.id](mailto:contact@fauzantaufiq.id)
- LinkedIn: [linkedin.com/in/fauzantaufiq](https://linkedin.com/in/fauzantaufiq)
- Behance: [behance.net/fauzantaufiq](https://behance.net/fauzantaufiq)
- Instagram: [@fauzan.taufiqq](https://instagram.com/fauzan.taufiqq)
