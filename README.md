# Muhammad Fauzan Taufiq Portfolio

Personal portfolio, campaign case study archive, and content management workspace for Muhammad Fauzan Taufiq.

Production URL: [https://fauzantaufiq.id](https://fauzantaufiq.id)

## Technology Stack

| Layer | Implementation |
| --- | --- |
| Markup | Semantic HTML5 (`index.html` public portfolio and `admin.html` CMS workspace) with native `<dialog>` modals |
| Styling | Modular CSS3 (`css/tokens.css`, `css/reset.css`, `css/layout.css`, `css/components.css`, `css/admin.css`) with zero runtime CSS framework |
| Client Scripts | Modular Vanilla JavaScript ES Modules (`js/public/`, `js/admin/`, `js/config/`, `js/utils/`) |
| Database & Storage | Supabase PostgreSQL, Supabase Auth, and `portfolio-images` Storage via a locally bundled `@supabase/supabase-js` client (`js/vendor/supabase-js.js`) |
| Serverless API | Vercel Serverless Function (`api/analytics.js`) aggregating authenticated 30-day usage and deployment telemetry |
| Edge & Delivery | Vercel static hosting (`dist/`) fronted by Cloudflare DNS, CDN caching, and WAF |

## Project Structure

- `index.html`: Public portfolio, spotlight case studies, client archive, experience/education index, and contact form.
- `admin.html`: Password and Magic Link authenticated CMS workspace (`/admin` rewrites to `/admin.html` in `vercel.json`).
- `api/analytics.js`: Authenticated `GET /api/analytics` endpoint verifying Supabase Bearer tokens against the admin email allowlist before querying Cloudflare, GA4, Search Console, and Vercel.
- `images/`: Local brand monograms (`logo-original.svg`, `logo-white.svg`), compressed hero cutout portrait (`profile-fauzan-cutout.webp`), PWA icons, and self-hosted software icons (`images/icons/`).
- `files/cv-fauzan-taufiq.pdf`: Downloadable and inline-previewable PDF resume.
- `scripts/vendor.mjs`: Bundles `@supabase/supabase-js` into `js/vendor/supabase-js.js`.
- `scripts/build-cities.mjs`: Generates 27 static alphabetical city shards (`a.json` through `z.json` plus `other.json`) from `@countrystatecity/countries` for the Admin Experience location combobox.
- `scripts/build.mjs`: Produces the minified `dist/` deployment directory using `esbuild` and `html-minifier-terser`.
- `rules/DESIGN.md`: Design tokens, contrast guardrails, responsive layout rhythm, and component purpose statements.

## Supabase Schema

| Table | Purpose |
| --- | --- |
| `portfolio_sections` | Campaign spotlight (`layout = 'spotlight'`) and archive (`slider` / `grid`) sections, narratives, badges, and highlight metrics |
| `portfolio_items` | Visual artifacts, external links, captions, and WebP artwork URLs linked via `section_id` |
| `experience` | Work history entries with structured month/year periods, searchable worldwide city locations, work types, and `is_featured` flags |
| `education` | University and high school credentials with optional GPA metadata |
| `competencies` | Core Creative Software (`arsenal`, with icon upload/URL) and Strategic & Production Capabilities (`other`) |
| `messages` | Inquiries submitted from the public contact form and managed in the Admin Inbox |

## Build Pipeline

Install dependencies:

```bash
npm install
```

Run the production build (bundles `js/vendor/supabase-js.js`, minifies HTML/CSS/JS via `html-minifier-terser` and `esbuild`, copies static assets into `dist/`, and writes the 27 city JSON shards into `dist/data/cities/`):

```bash
npm run build
```

Regenerate only the 27 static city shards (`data/cities/` and, if present, `dist/data/cities/`):

```bash
npm run build:cities
```

Rebuild only the vendored Supabase client bundle:

```bash
npm run vendor
```

## Admin Telemetry & Environment Variables

The Overview tab in `/admin` calls `GET /api/analytics` with the signed-in administrator's Supabase Bearer token. Each provider degrades independently to a `Not Configured` card until its environment variables are added in Vercel Project Settings:

| Variable | Provider | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare | API token with Zone Analytics read permission for GraphQL `httpRequests1dGroups` |
| `CLOUDFLARE_ZONE_ID` | Cloudflare | Target Cloudflare Zone ID for `fauzantaufiq.id` |
| `VERCEL_API_TOKEN` | Vercel | Bearer token for querying recent deployment states and build durations |
| `VERCEL_PROJECT_ID` | Vercel | Vercel Project ID (`prj_...`) filtered on `/v6/deployments` |
| `GOOGLE_CLIENT_EMAIL` | Google (GA4 & GSC) | Service account client email granted Viewer access on GA4 and Search Console |
| `GOOGLE_PRIVATE_KEY` | Google (GA4 & GSC) | PEM private key used to sign short-lived RS256 OAuth JWTs via `node:crypto` |
| `GA4_PROPERTY_ID` | Google Analytics 4 | Numeric GA4 Property ID queried for 30-day active users, sessions, views, and engagement |
| `GSC_SITE_URL` | Google Search Console | Verified Search Console property URL (for example `sc-domain:fauzantaufiq.id` or `https://fauzantaufiq.id/`) |

Optional server overrides supported by `api/analytics.js`: `VERCEL_TEAM_ID`, `ADMIN_ALLOWED_EMAILS`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`.

## Local Development

Pull project environment variables from Vercel and start the local Vercel runtime (serves both static routes and `/api/analytics`):

```bash
npx vercel env pull .env.local
npx vercel dev
```

To preview only the compiled static `dist/` directory without serverless functions:

```bash
npm run build
npx serve dist -l 4173
```

## Contact

- Email: [contact@fauzantaufiq.id](mailto:contact@fauzantaufiq.id)
- LinkedIn: [linkedin.com/in/fauzantaufiq](https://linkedin.com/in/fauzantaufiq)
- Behance: [behance.net/fauzantaufiq](https://behance.net/fauzantaufiq)
- Instagram: [instagram.com/fauzan.taufiqq](https://instagram.com/fauzan.taufiqq)
