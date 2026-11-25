\# REVAMP-SPEC.md : Arsitektur Teknis, Data \& Konten (`fauzantaufiq.id`)



\## 1. Tujuan \& Batasan Infrastruktur

\* \*\*Target Domain:\*\* `fauzantaufiq.id` (dideploy melalui Vercel Free, backend Supabase Free, DNS \& keamanan Cloudflare Free).

\* \*\*Arsitektur Tanpa Bundler:\*\* Pertahankan stack HTML5, CSS3 modular, dan Vanilla JavaScript (native ES Modules via `<script type="module">`). Jangan migrasi ke Next.js, Vue, atau Vite agar tidak menambah beban build dan tetap menjaga kompatibilitas statis di Vercel Free.

\* \*\*Kontrak Visual:\*\* Seluruh styling, palet warna (`#b54f26`, `#f5f5f7`, `#ffffff`, `#1d1d1f`, `#000000`), tipografi, dan tata letak asimetris wajib mengikuti `DESIGN.md` tanpa pengecualian.

\* \*\*Bahasa Antarmuka:\*\* Gunakan \*\*English\*\* secara konsisten untuk seluruh copywriting halaman publik (`index.html`) dan panel admin (`admin.html`). Jangan mencampur bahasa Indonesia dan Inggris dalam elemen UI.



\---



\## 2. Struktur Direktori Modular (Pemecahan File Monolitik)



Pecah `index.html` (95 KB) dan `admin.html` (145 KB) menjadi struktur file modular berikut agar mudah dipelihara dan di-cache secara efisien oleh browser:



```text

/

├── index.html                  # Markup semantik halaman publik

├── admin.html                  # Markup semantik panel admin

├── manifest.json               # Konfigurasi PWA (pertahankan)

├── robots.txt                  # Konfigurasi SEO (pertahankan)

├── sitemap.xml                 # Peta situs (pertahankan)

├── vercel.json                 # Header cache \\\& routing statis

├── DESIGN.md                   # Kontrak desain visual

├── REVAMP-SPEC.md              # Spesifikasi teknis \\\& konten ini

├── images/                     # Seluruh aset statis lokal (0 egress Supabase)

│   ├── logo-ft-black.svg       # Monogram FT hitam untuk navbar terang

│   ├── logo-ft-white.svg       # Monogram FT putih untuk footer gelap

│   ├── profile-fauzan.webp     # Foto profil editorial (< 120 KB)

│   └── icons/                  # Ikon sosial \\\& UI lokal (SVG ringan)

├── css/

│   ├── tokens.css              # CSS Custom Properties dari DESIGN.md

│   ├── reset.css               # Normalisasi gaya, fokus keyboard, \\\& reduced-motion

│   ├── layout.css              # Grid asimetris, navbar tunggal, \\\& ritme seksi

│   ├── components.css          # Tombol kapsul, frame media, modal, \\\& state UI

│   └── admin.css               # Styling khusus admin.html (menggunakan tokens.css)

└── js/

\&#x20;   ├── config/

\&#x20;   │   └── supabase-client.js  # Inisialisasi tunggal Supabase client \\\& konstanta bucket

\&#x20;   ├── utils/

\&#x20;   │   ├── dom.js              # Helper sanitasi HTML (cegah XSS), format tanggal, \\\& fokus trap

\&#x20;   │   └── observer.js         # IntersectionObserver untuk animasi scroll-reveal (MOTION 2)

\&#x20;   ├── public/

\&#x20;   │   ├── main.js             # Entry point halaman publik

\&#x20;   │   ├── render-portfolio.js # Fetch \\\& render Featured Spotlight, Client Work, \\\& Playground

\&#x20;   │   ├── render-profile.js   # Fetch \\\& render Experience, Education, \\\& Competencies

\&#x20;   │   ├── modal-lightbox.js   # Modal pratinjau karya \\\& dokumen (bisa ditutup dengan Escape)

\&#x20;   │   └── contact-form.js     # Validasi \\\& pengiriman pesan ke tabel contact\\\_messages

\&#x20;   └── admin/

\&#x20;       ├── admin-main.js       # Entry point panel admin \\\& manajemen tab

\&#x20;       ├── auth.js             # Login Email/Password \\\& Supabase Magic Link

\&#x20;       ├── crud-portfolio.js   # Manajemen portfolio\\\_sections \\\& portfolio\\\_items (upload WebP)

\&#x20;       ├── crud-profile.js     # Manajemen experience, education, \\\& competencies

\&#x20;       └── inbox.js            # Manajemen pesan masuk (filter All/Unread/Read, Mark All Read)


