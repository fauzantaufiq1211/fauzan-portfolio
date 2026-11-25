# ANTIGRAVITY-PROMPTS.md : Panduan Eksekusi Bertahap (`fauzantaufiq.id`)

> \*\*Aturan Main untuk Antigravity:\*\*
> Sebelum menulis kode pada setiap fase, wajib baca `DESIGN.md` dan `REVAMP-SPEC.md` di direktori root proyek. Jangan gunakan bundler (Vite/Webpack/Next.js); gunakan HTML5, CSS3 modular, dan Vanilla JavaScript native ES Modules (`type="module"`).

\---

## Fase 0 : Backup \& Ekstraksi Skema Supabase (Read-Only)

**Tujuan:** Memetakan seluruh kredensial publik Supabase, nama bucket, nama tabel, dan nama kolom dari kode lama agar tidak ada data yang terputus saat refaktor.

**Prompt untuk Antigravity:**

```text
Read `DESIGN.md`, `REVAMP-SPEC.md`, `index.html`, and `admin.html` completely. Do NOT modify or delete any existing files yet.

Your task in this phase is strictly diagnostic and extraction:
1. Extract the exact Supabase initialization details (Supabase URL, public anon key, and Storage bucket names) currently used in `index.html` and `admin.html`.
2. Map out the exact database table names, column names, foreign key relationships, and query filters currently used for:
   - Portfolio sections (`portfolio\_sections` or equivalent)
   - Portfolio items (`portfolio\_items` or equivalent)
   - Work experience (`experience` or equivalent)
   - Education (`education` or equivalent)
   - Competencies/tools (`competencies` or equivalent)
   - Contact messages (`contact\_messages` or equivalent)
   - Admin authentication flow (Email/Password and Magic Link redirect URLs)
3. Check the local `images/` directory and list which static assets (logos, profile photos, icons) already exist locally versus which ones are still hardcoded to Supabase Storage URLs.
4. Create a temporary reference file named `SCHEMA-NOTES.md` documenting all extracted Supabase configs, table columns, and asset paths so subsequent phases preserve 100% database compatibility.

