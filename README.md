Tentu, ini adalah draf **README.md** yang profesional, lengkap, dan siap pakai untuk repository GitHub Anda.

File ini dirancang agar siapa pun (rekruter atau developer lain) yang melihat kode Anda langsung paham bahwa proyek ini dibuat dengan struktur yang rapi dan logika yang canggih.

Silakan buat file baru bernama `README.md` di folder proyek Anda, lalu _copy-paste_ kode di bawah ini:

---

````markdown
# ✨ Personal Portfolio Website

![Project Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

> **"Where Strategy Meets Aesthetic."**

Website portofolio pribadi yang modern, responsif, dan interaktif. Dibangun untuk menampilkan pengalaman profesional, kepemimpinan organisasi, dan hasil karya kreatif (Portfolio Showcase) dengan pengalaman pengguna (UX) yang halus.

🔗 **Live Demo:** [https://nama-project-anda.vercel.app](https://nama-project-anda.vercel.app) _(Ganti dengan link Vercel Anda nanti)_

---

## 🚀 Fitur Unggulan

Website ini bukan sekadar HTML statis biasa. Di dalamnya terdapat logika JavaScript kustom untuk meningkatkan interaktivitas:

### 🎨 UI/UX Interaktif

- **Sliding Pill Navigation:** Navigasi bar dengan efek "kapsul" yang bergerak mengikuti posisi _hover_ mouse (desktop) dan kembali ke posisi "Contact" saat mouse keluar.
- **Chameleon Scrollbar:** Scrollbar browser otomatis berubah warna dari _Terracotta_ menjadi _Hitam_ saat melewati bagian dengan latar belakang berwarna sama (untuk menjaga kontras).
- **Apple Ecosystem Fonts:** Menggunakan strategi _Font Stack_ yang memprioritaskan font "San Francisco" pada perangkat Apple dan "Inter" pada perangkat lain.

### 📱 Fully Responsive

- **Mobile-First Approach:** Layout grid yang fleksibel (Stacking pada mobile, Row pada desktop).
- **Touch-Friendly Sliders:** Galeri portofolio dapat digeser (_swipe_) menggunakan jari pada layar sentuh.

### ⚡ Data-Driven Content

- **Automated Portfolio Rendering:** Tidak ada kode HTML repetitif. Seluruh konten portofolio disimpan dalam **JavaScript Array (JSON Object)**, sehingga menambah proyek baru cukup dengan menambah satu baris data.

### 📬 Functional Form

- **Contact Form:** Terintegrasi dengan **Formspree** untuk pengiriman pesan langsung ke email tanpa backend server.

---

## 🛠️ Teknologi yang Digunakan

- **HTML5:** Struktur semantik dan aksesibel.
- **Tailwind CSS (CDN):** Framework _Utility-First_ untuk styling yang cepat dan konsisten.
- **Vanilla JavaScript (ES6+):** Logika interaksi tanpa ketergantungan _library_ pihak ketiga yang berat.
- **Vercel:** Platform deployment dan hosting (Edge Network).

---

## 📂 Struktur Folder

```text
PORTFOLIO-WEBSITE/
├── 📂 images/              # Aset gambar (Logo, Foto, Portfolio)
│   ├── 📂 contact/         # Ikon sosial media
│   ├── 📂 creative-arsenal/# Logo software
│   ├── 📂 ft-logo/         # Logo personal
│   └── 📂 portfolio/       # Gambar hasil karya
├── 📄 index.html           # File utama (HTML + CSS + JS)
└── 📄 README.md            # Dokumentasi proyek
```
````

---

## 💻 Cara Menjalankan di Lokal

Karena proyek ini menggunakan Tailwind via CDN, Anda tidak perlu menginstal Node.js atau NPM.

1. **Clone Repository**

```bash
git clone [https://github.com/username-anda/nama-repo.git](https://github.com/username-anda/nama-repo.git)

```

2. **Buka Folder Proyek**
   Buka folder tersebut di Visual Studio Code.
3. **Jalankan dengan Live Server**

- Install ekstensi **Live Server** di VS Code.
- Buka `index.html`.
- Klik kanan -> **"Open with Live Server"**.
- Website akan berjalan di `http://127.0.0.1:5500`.

---

## ⚙️ Cara Mengupdate Konten

### 1. Menambah Proyek Portofolio Baru

Buka file `index.html`, gulir ke bawah sampai bagian `<script>`. Cari variabel `const portfolioData`. Tambahkan objek baru di dalam array `works`:

```javascript
// Contoh penambahan karya baru:
{
    type: "Instagram Feed",
    img: "images/portfolio/proyek-baru.jpg",
    link: "[https://instagram.com/](https://instagram.com/)...",
    btnText: "View Post"
},

```

### 2. Mengatur Formulir Kontak

Cari tag `<form>` di bagian bawah `index.html` dan ganti URL `action` dengan URL Formspree Anda sendiri:

```html
<form
  action="[https://formspree.io/f/KODE_UNIK_ANDA](https://formspree.io/f/KODE_UNIK_ANDA)"
  method="POST"
></form>
```

---

## 🤝 Contact

**Muhammad Fauzan Taufiq**

- 📍 Digital Creative Specialist & Social Media Strategist
- 📧 Email: [fauzantaufiq1211@gmail.com](mailto:fauzantaufiq1211@gmail.com)
- 💼 LinkedIn: [linkedin.com/in/fauzantaufiq](https://linkedin.com/in/fauzantaufiq)
- 📷 Instagram: [@fauzan.taufiqq](https://instagram.com/fauzan.taufiqq)

---

<p align="center">
Dibuat dengan ❤️ dan ☕.
</p>

```

### Tips Tambahan:

1.  **Ganti URL:** Jangan lupa ganti `https://nama-project-anda.vercel.app` dan `https://github.com/username-anda` dengan link asli milik Anda nanti.
2.  **Screenshot (Opsional):** Jika Anda ingin README lebih keren, Anda bisa menambahkan screenshot tampilan website Anda di bagian bawah judul menggunakan kode: `![Screenshot Website](images/screenshot.png)`.

```
