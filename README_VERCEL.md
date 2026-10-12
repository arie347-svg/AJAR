# Panduan Lengkap Deploy Aplikasi AJAR ke Vercel (Backend GAS)

Aplikasi **AJAR (Aplikasi Jurnal dan Administrasi Pembelajaran - MAN 1 Majalengka)** kini telah dikonfigurasi dengan arsitektur **Hybrid Headless**:
- **Frontend & PWA**: Dihosting di **Vercel** (akses super cepat, domain kustom, bisa di-install di layar utama HP).
- **Backend & Database**: Tetap di **Google Apps Script (GAS)** dan **Google Sheets** (gratis, tanpa perlu migrasi database).
- **Dual-Compatibility**: Tetap 100% kompatibel jika dibuka langsung dari Google Apps Script Web App tanpa perubahan apapun.

---

## 🚀 Langkah 1: Update & Deploy Backend Google Apps Script

1. Buka spreadsheet database Anda, lalu klik **Ekstensi** > **Apps Script**.
2. Salin seluruh isi file [`Code.gs`](file:///c:/Users/Ari/antigravity/AJAR/Code.gs) yang terbaru ke editor Apps Script.
3. Klik tombol **Deploy** (di pojok kanan atas) > pilih **New deployment** (Penerapan baru).
4. Klik ikon roda gigi ⚙️ di sebelah kiri, pilih tipe **Web App**:
   - **Description**: `AJAR Vercel API Gateway`
   - **Execute as**: `Me (email Anda)`
   - **Who has access**: `Anyone` *(Penting agar Vercel dapat mengakses API)*
5. Klik **Deploy**.
6. **Salin Web App URL** yang muncul (format: `https://script.google.com/macros/s/AKfycb.../exec`).

---

## 🐙 Langkah 2: Upload Project ke GitHub

1. Buka terminal di folder project ini (`c:\Users\Ari\antigravity\AJAR`).
2. Jalankan perintah git:
   ```bash
   git init
   git add .
   git commit -m "Siap deploy ke Vercel"
   ```
3. Buat repositori baru di [GitHub](https://github.com) (bisa Private maupun Public).
4. Hubungkan dan push ke GitHub:
   ```bash
   git branch -M main
   git remote add origin https://github.com/USERNAME_ANDA/ajar-man1majalengka.git
   git push -u origin main
   ```

---

## ▲ Langkah 3: Deploy ke Vercel

1. Buka [Vercel Dashboard](https://vercel.com) dan login (bisa menggunakan akun GitHub).
2. Klik tombol **Add New...** > **Project**.
3. Cari repositori GitHub Anda (`ajar-man1majalengka`) lalu klik **Import**.
4. Di bagian pengaturan project:
   - **Framework Preset**: Biarkan `Other`.
   - **Root Directory**: `./` (default).
5. Buka bagian **Environment Variables** (Sangat Penting!):
   - **Key**: `GAS_DEPLOYMENT_URL`
   - **Value**: Tempelkan Web App URL yang Anda salin dari Langkah 1 (`https://script.google.com/macros/s/.../exec`).
   - Klik tombol **Add**.
6. Klik tombol **Deploy**.
7. Tunggu sekitar 15–30 detik hingga proses deployment selesai dan status menunjukkan **Congratulations!**.

---

## 📱 Langkah 4: Menjadikan Aplikasi PWA di HP (Layar Penuh Tanpa Browser Bar)

Aplikasi telah dilengkapi `manifest.json` dan konfigurasi PWA:
- **Di Android (Google Chrome)**: Buka URL Vercel Anda > ketuk titik tiga di pojok kanan atas > pilih **"Instal aplikasi"** atau **"Tambahkan ke Layar Utama"**.
- **Di iPhone / iPad (Safari)**: Buka URL Vercel Anda > ketuk tombol Share (ikon kotak panah ke atas) > pilih **"Tambahkan ke Layar Utama (Add to Home Screen)"**.

Aplikasi AJAR akan muncul di home screen layaknya aplikasi mobile native dengan logo Kemenag dan tema hijau madrasah.

---

## ⚙️ Ringkasan Struktur Berkas Vercel

| File | Fungsi |
|---|---|
| [`api/gas.js`](file:///c:/Users/Ari/antigravity/AJAR/api/gas.js) | Serverless Reverse Proxy yang menangani CORS & redirect HTTP 302 dari Google secara mulus |
| [`vercel.json`](file:///c:/Users/Ari/antigravity/AJAR/vercel.json) | Konfigurasi routing URL dan rewrite menuju `Index.html` |
| [`manifest.json`](file:///c:/Users/Ari/antigravity/AJAR/manifest.json) | Metadata PWA untuk instalasi mobile (nama, ikon Kemenag, tema warna) |
| [`package.json`](file:///c:/Users/Ari/antigravity/AJAR/package.json) | Konfigurasi project metadata |
| [`Index.html`](file:///c:/Users/Ari/antigravity/AJAR/Index.html) | Frontend antarmuka dengan Universal GAS Bridge yang otomatis aktif di Vercel |
| [`Code.gs`](file:///c:/Users/Ari/antigravity/AJAR/Code.gs) | Backend Google Apps Script dengan router `doPost` untuk 24 endpoint API |
