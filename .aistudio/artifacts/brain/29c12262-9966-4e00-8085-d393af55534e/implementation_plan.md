# Rencana Implementasi: Penyederhanaan Tampilan Loading, Pembersihan Indikator GAS, dan Tombol Login/Signup Bersih

Rencana ini merinci penyesuaian UX/UI untuk menyederhanakan pengalaman awal pengguna: menyederhanakan layar pemuatan sistem (splash screen) menjadi logo terpusat dengan teks *Connecting...* bertema Neumorphic / Soft UI Modern, menghapus penanda status GAS/Secret GAS_URL di halaman otentikasi, serta menghilangkan animasi menghubungkan bertahap saat menekan tombol Login atau Sign Up.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Verifikasi koneksi nyata ke Google Apps Script (GAS) dan sinkronisasi data spreadsheet tetap berjalan 100% di latar belakang (background handshake). Perubahan ini murni menyederhanakan presentasi visual agar lebih minimalis, elegan, dan bebas distraksi teknis.

- **Keputusan 1 (Splash Screen Minimalis)**: Menampilkan pedestal squircle Neumorphic berisikan `AjarBrandLogo` persis seperti di halaman login, diposisikan tepat di tengah layar dengan tulisan "Connecting..." di bawahnya, menghilangkan kartu informasi teks panjang dan bar persentase.
- **Keputusan 2 (Penghapusan Badge GAS di Login/Daftar)**: Menghapus elemen penanda "GAS Online • Secret GAS_URL" / "Spreadsheet Aktif" pada `AuthPage.tsx` agar tampilan login/signup bersih layaknya aplikasi produksi profesional.
- **Keputusan 3 (Otentikasi Bersih Tanpa Animasi Menghubungkan)**: Menghilangkan baris status progress bertahap (1/3, 2/3, 3/3 dan animasi ping "Menghubungkan ke server madrasah...") saat tombol login/signup ditekan; tombol langsung menampilkan indikator *loading* standar dan memproses otentikasi langsung ke server.

---

### 1. Overview & Core Concept

- **Apa yang Dilakukan**:
  1. **Layar Loading Sistem (Splash)**: Mengubah tampilan loading awal menjadi komponen terpusat minimalis bertema Neumorphism (latar `#EBF0F8`), terdiri dari ubin squircle 3D raised dengan logo brand AJAR dan teks "Connecting..." yang berdenyut lembut (*subtle pulse*).
  2. **Halaman Otentikasi (`AuthPage`)**: Menghilangkan badge status koneksi GAS ("GAS Online / Secret GAS_URL") di atas formulir login dan signup.
  3. **Aksi Tombol Login & Signup**: Menghapus animasi teks simulasi koneksi dan progress bar bertingkat ketika form disubmit. Menggantinya dengan status *loading spinner* minimalis pada tombol tanpa menutupi atau menggeser form.
- **Target Pengguna**: Guru dan tenaga pendidik MAN 1 Majalengka yang menginginkan pengalaman antarmuka yang cepat, tenang, bersih, dan profesional tanpa visual noise teknis.
- **Nilai Utama**: Mempertahankan reliabilitas sinkronisasi data nyata dengan antarmuka yang jauh lebih bersih dan estetis.

---

### 2. User Experience & Visual Design

#### A. Alur Layar Splash Minimalis (System Boot)
```
┌────────────────────────────────────────────────────────┐
│                                                        │
│                    Latar: #EBF0F8                      │
│                                                        │
│                   ┌────────────────┐                   │
│                   │   [3D Logo]    │                   │
│                   │  Neu Squircle  │                   │
│                   └────────────────┘                   │
│                                                        │
│                     Connecting...                      │
│                                                        │
│                                                        │
└────────────────────────────────────────────────────────┘
```
- **Wadah**: `fixed inset-0 bg-[#EBF0F8] flex flex-col items-center justify-center select-none`
- **Ubin Logo**: Menggunakan komponen yang identik dengan login: `neu-logo-tile w-24 h-24 sm:w-28 sm:h-28 rounded-[30px] sm:rounded-[36px]` dengan bayangan Soft UI Neumorphic ganda.
- **Teks Indikator**: Tulisan `Connecting...` berukuran `text-sm sm:text-base font-semibold tracking-wider text-slate-500 mt-4 animate-pulse`.
- **Ketahanan Sistem**: Jika terjadi timeout ekstrem pada jaringan (>15 detik), sistem menampilkan opsi Neumorphic lembut "Muat Ulang" atau "Lanjutkan Offline" agar pengguna tidak terblokir.

#### B. Pembersihan Halaman Login & Signup
- Header login hanya menampilkan ubin logo, judul ("Welcome Back" / "Daftar Akun"), dan subjudul informasi.
- Badge "GAS Online • Secret GAS_URL" dihapus sepenuhnya.

#### C. Penekanan Tombol Login & Signup
- Saat tombol "Login" atau "Daftar Akun" ditekan:
  - Form input terkunci (`disabled={loading}`) untuk mencegah *double submit*.
  - Tidak ada lagi kotak status berbunyi "Menghubungkan ke server madrasah... (1/3)".
  - Tombol CTA menampilkan spinner halus di sebelah teks aksi.
  - Begitu verifikasi GAS selesai, langsung berpindah ke dasbor atau memunculkan pesan toast kesalahan yang jelas jika kredensial salah.

---

### 3. Key Product Decisions & Trade-Offs

- **Keputusan Desain Splash**: Menggunakan logo pedestal squircle yang identik dengan `AuthPage` alih-alih kartu informasi lebar.
  - *Alasan*: Konsistensi visual dan transisi yang mulus ke halaman login tanpa efek loncatan layout (*layout shift*).
- **Penghapusan Penanda Teknis**:
  - *Alasan*: Label seperti "Secret GAS_URL" membingungkan pengguna umum dan terkesan seperti mode debugging internal pengembang.
- **Pembersihan Animasi Login Bertingkat**:
  - *Alasan*: Animasi bertahap 3-step membuat proses login terasa dibuat-buat (*artificial delay*). Otentikasi langsung dengan umpan balik cepat memberikan persepsi performa yang jauh lebih responsif.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                           System Lifecycle                             │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                   (Mount: App Initial Boot)
                                 │
                                 ▼
               ┌───────────────────────────────────┐
               │    Splash Screen: Centered Logo   │
               │         + "Connecting..."         │
               └───────────────────────────────────┘
                                 │
           ┌─────────────────────┴─────────────────────┐
           ▼                                           ▼
  [GET /api/gas/status]                     [getReferencesData]
  (Ping runtime GAS)                       (Ambil Rombel 60 Kelas)
           │                                           │
           └─────────────────────┬─────────────────────┘
                                 │
                         (Handshake Sukses)
                                 │
                                 ▼
               ┌───────────────────────────────────┐
               │       AuthPage (Login / Sign Up)  │
               │  • Logo Bersih & Form             │
               │  • Tanpa Badge GAS Online         │
               │  • Tombol Submit Bersih & Cepat   │
               └───────────────────────────────────┘
```

#### Modifikasi Komponen:
1. **`src/App.tsx`**:
   - Ganti isi elemen render splash screen (`loadingSplash`) dengan container terpusat: logo tile `neu-logo-tile` berisikan `AjarBrandLogo idPrefix="splash"` dan teks `Connecting...` bertema Neumorphic.
   - Tetap pertahankan proses sinkronisasi `checkGasConnection()` dan pemuatan referensi resmi di balik layar.
2. **`src/components/AuthPage.tsx`**:
   - Hapus rendering badge status `gasConnection` (baris 291-321).
   - Hapus state dan elemen micro-progress `loadingStatus`, `loadingStep`, `stepTimer1`, `stepTimer2` pada `handleLoginSubmit` dan `handleRegisterSubmit`.
   - Pastikan tombol CTA tetap responsif dengan *loading state* internal tombol saja.

---

### 5. Verification Plan

1. **Uji Kompilasi & Lint**:
   - Menjalankan `compile_applet` dan `lint_applet` untuk menjamin tidak ada regresi kode atau variabel tak terpakai.
2. **Uji Tampilan Splash Screen**:
   - Memastikan saat aplikasi dibuka, hanya muncul logo di tengah dan teks "Connecting..." dengan gaya Neumorphic yang serasi.
3. **Uji Tampilan Halaman Login & Signup**:
   - Memastikan tidak ada teks/badge "GAS Online Secret GAS_URL" baik di form login maupun form sign up.
4. **Uji Aksi Login & Signup**:
   - Memastikan saat menekan tombol login atau signup, tidak ada animasi kotak "Menghubungkan..." yang muncul, melainkan proses langsung berjalan dengan mulus.
