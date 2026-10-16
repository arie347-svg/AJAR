# Perbaikan Presensi: Pengurutan Kelas, Validasi Siswa Kosong, Label Pertemuan & Pemuatan Siswa

Rencana implementasi ini dirancang untuk menyempurnakan fitur Presensi di aplikasi AJAR MAN 1 Majalengka: menghadirkan indikator taktil bagi kelas yang belum memiliki data siswa beserta dialog validasi upload data siswa, memperbaiki algoritma pengurutan kelas agar kelas bernomor besar (seperti XI.10) berada di urutan semestinya, menyederhanakan teks dropdown pertemuan menjadi "Pertemuan 1" tanpa embel-embel simbol "#", serta menyelesaikan masalah pemuatan siswa saat pertemuan dipilih dengan strategi *multi-source student resolver*.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Keputusan Teknis & UX yang Disepakati:**
> 1. **Tindakan Validasi Saat Kelas Kosong Diklik:** Ketika guru mengklik kartu kelas yang belum memiliki siswa, sistem akan memunculkan dialog konfirmasi taktil (Modern Neumorphic Modal) yang menjelaskan bahwa kelas belum memiliki data siswa, disertai tombol aksi langsung menuju **Master Siswa** untuk mengunggah file Excel / menyinkronkan data siswa dari Google Spreadsheet.
> 2. **Penyortiran Numerik Kelas (Natural Sorting):** Mengganti `localeCompare` standar yang berbasis abjad murni (`XI.1, XI.10, XI.2`) dengan perbandingan berbasis numerik (*natural comparison*), sehingga urutan kelas berurutan logis: `XI.1, XI.2, ..., XI.9, XI.10, XI.11`.
> 3. **Penyederhanaan Teks Pertemuan:** Menghapus seluruh tampilan format kode `#1`, `#2` pada tombol maupun daftar dropdown. Setiap item menampilkan label bersih dan proporsional: `Pertemuan {nomor}` dipadukan dengan indikator status kehadiran (LED hijau bila sudah tersimpan).
> 4. **Multi-Source Student Resolver untuk Presensi:** Ketika pertemuan dipilih di lembar presensi, pemanggilan tidak hanya mengandalkan satu kunci respon dari GAS, melainkan secara berlapis memeriksa `res.siswa`, `res.data`, `res.daftarSiswa`, cache terisolasi `localStorage.getItem('ajar_siswa_' + kelas)`, dan memicu sinkronisasi otomatis `getMasterSiswa` jika spreadsheet belum ter-cache.

---

### 1. Overview & Core Concept

- **Apa yang Dihadirkan**:
  1. **Indikator Siswa & Validasi Kelas Kosong**: Kartu rombel pada daftar presensi menampilkan status jumlah siswa atau badge taktil ringkas "Belum Ada Siswa" jika data siswa kelas tersebut masih kosong. Klik pada kelas kosong menampilkan modal validasi informatif dengan tombol navigasi instan ke modul Master Siswa.
  2. **Pengurutan Kelas Natural (Numeric-Aware)**: Daftar kartu kelas terurut dari angka terkecil hingga terbesar (`XI.1` hingga `XI.10` dst.) secara konsisten di semua tingkatan (X, XI, XII).
  3. **Label Dropdown Pertemuan Bersih**: Format penamaan pertemuan seragam `Pertemuan 1`, `Pertemuan 2`, dst., tanpa simbol pagar `#`, menjaga estetika Neumorphic yang minimalis dan teratur.
  4. **Pemuatan Siswa Presensi yang Andal**: Lembar presensi menjamin nama siswa dari spreadsheet selalu tampil ketika pertemuan diklik, lengkap dengan status kehadiran (Hadir/Izin/Sakit/Alpa) dan tanggal pertemuan.
- **Sasaran Pengguna**: Guru MAN 1 Majalengka yang melakukan pencatatan kehadiran harian di kelas tanpa hambatan data kosong atau kartu teracak.

---

### 2. User Experience & Visual Design

#### A. Tampilan Kartu Kelas & Indikator Siswa Kosong
- **Wujud Kartu Kelas (`neu-raised-card`)**:
  - Menampilkan nama kelas dan mata pelajaran dengan kontras tajam.
  - Untuk kelas dengan data siswa: Menampilkan jumlah siswa terdaftar (misal `36 Siswa`) secara ringkas dan bersih.
  - Untuk kelas **belum ada siswa**: Menampilkan badge peringatan taktil bernuansa amber lembut (`neu-inset bg-[#FFFBEB] text-amber-800 border-amber-300/60`) dengan ikon peringatan kecil dan label teks `"Belum Ada Siswa"`.
- **Modal Validasi Upload Siswa (`neu-raised-card` Dialog)**:
  - Header: Ikon peringatan taktil dengan judul *"Data Siswa Belum Tersedia"*.
  - Deskripsi: *"Kelas [Nama Kelas] belum memiliki data siswa terdaftar di sistem. Anda perlu mengunggah atau menyinkronkan data siswa terlebih dahulu sebelum dapat mengisi presensi."*
  - Tombol Aksi:
    - **Unggah / Kelola Siswa**: Tombol primer beraksen biru (`neu-btn-primary`) yang langsung mengarahkan guru ke halaman **Master Siswa** dengan kelas tersebut langsung terpilih.
    - **Tutup / Batal**: Tombol sekunder taktil cembung untuk menutup dialog.

#### B. Pengurutan Kelas Natural
- Algoritma pemilahan kelas menggunakan pemisah blok numerik (*natural sort comparison*):
  - Membandingkan tingkat (`X` < `XI` < `XII`).
  - Membandingkan nomor rombel secara numerik: `1 < 2 < 3 ... < 9 < 10 < 11`.
  - Hasil: `XI.10` diposisikan di bawah `XI.9`, bukan di atas `XI.2`.

#### C. Dropdown Pertemuan Bersih & Minimalis
- Item dropdown menampilkan:
  - Teks utama: `Pertemuan {p}` (tanpa awalan `#` atau badge kotak berlebih).
  - Tanda status: Indikator LED emerald tersimpan + label tanggal kecil untuk pertemuan yang sudah pernah diisi.
  - Status aktif: Efek tekan mekanis (`neu-inset` dengan border aksen kobalt).

#### D. Pemuatan Data Siswa Presensi Multi-Layer
- Alur saat guru memilih nomor pertemuan:
  1. Sistem menampilkan spinner taktil halus saat memuat data.
  2. Memeriksa respon dari `getAbsensiData`. Jika array siswa tersedia, data dinormalisasi dan ditampilkan.
  3. Jika `getAbsensiData` hanya mengembalikan map kehadiran (tanpa array data siswa lengkap), sistem secara otomatis mengambil daftar siswa dari cache lokal kelas tersebut (`ajar_siswa_{kelas}`).
  4. Jika cache lokal belum ada, sistem otomatis mengeksekusi `getMasterSiswa` ke spreadsheet GAS, menormalisasi data kolom (mendukung variasi nama field dari spreadsheet: `Nama Siswa`, `NamaSiswa`, `nama`, `NISN`, `NIS`), lalu merender tabel presensi.
  5. Kehadiran default diset `Hadir (H)` untuk siswa yang belum memiliki riwayat pada pertemuan tersebut.

---

### 3. Key Product Decisions & Trade-Offs

- **Keputusan 1: Mekanisme Natural Sorting di Komponen Rombel**
  - *Pendekatan*: Menggunakan fungsi pembantu `naturalCompare(a.kelas, b.kelas)` yang memisahkan bagian teks rombel dan mem-parsing angka rombel dengan `parseInt(num, 10)`.
  - *Alasan*: Pengurutan bawaan JavaScript `localeCompare()` tanpa opsi numerik mengurutkan berdasarkan karakter ASCII (`"10"` diawali `"1"`, sehingga berada sebelum `"2"`). Natural sorting memberikan urutan yang intuitif bagi guru.
- **Keputusan 2: Penanganan Lembar Presensi untuk Kelas Kosong**
  - *Pendekatan*: Memblokir pembukaan lembar presensi jika kelas benar-benar belum memiliki siswa dan menampilkan dialog validasi terarah.
  - *Alasan*: Mencegah guru membuka formulir kosong yang tidak dapat disimpan (tombol simpan dinonaktifkan karena `siswaList.length === 0`), serta langsung memberikan solusi cepat berupa tautan ke Master Siswa.
- **Keputusan 3: Multi-Layer Fallback Data Siswa Presensi**
  - *Pendekatan*: `loadAbsensiData` menggabungkan metadata presensi dari `getAbsensiData` dengan data master siswa dari `getMasterSiswa` / `ajar_siswa_{kelas}`.
  - *Alasan*: Menjamin tabel presensi tidak pernah kosong saat spreadsheet sebenarnya memiliki data siswa namun endpoint presensi GAS hanya mengirimkan matriks nilai/status tanpa menduplikasi data master siswa.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        KOMPONEN PRESENSI (Absensi)                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌───────────────────────────────┐         ┌──────────────────────────────┐
│  Daftar Kelas (Natural Sort)  │         │  Lembar Presensi Fullscreen  │
│  - X.1 ... X.10               │         │  - Dropdown: 'Pertemuan 1'   │
│  - XI.1 ... XI.10             │         │  - Input Tanggal             │
│  - XII.1 ... XII.10           │         │  - Tabel Daftar Siswa        │
└──────────────┬────────────────┘         └──────────────┬───────────────┘
               │                                         │
               ├─────────────────────────────────────────┤
               ▼                                         ▼
┌───────────────────────────────┐         ┌──────────────────────────────┐
│  Validasi Kelas Belum Ada     │         │  Multi-Source Siswa Resolver │
│  Siswa: Modal Neumorphic      │         │  1. getAbsensiData (GAS)     │
│  -> Direct ke Master Siswa    │         │  2. Cache ajar_siswa_{kelas} │
│                               │         │  3. getMasterSiswa (GAS)     │
└───────────────────────────────┘         └──────────────────────────────┘
```

#### Komponen dan Modifikasi File:
1. **`src/components/Absensi.tsx`**:
   - Menambahkan utilitas pengurutan numerik (`naturalCompare`) untuk menyusun `rombelList` dan `displayedRombels`.
   - Mengambil jumlah siswa kelas (`classCounts`) dari cache lokal atau pre-fetch ringan.
   - Menambahkan badge ringkas `"Belum Ada Siswa"` pada kartu kelas dengan count = 0.
   - Menambahkan State & Modal Validasi: jika kelas dengan 0 siswa diklik, tampilkan dialog taktil untuk navigasi ke Master Siswa.
   - Merapikan label item di `NeuMeetingSelect`: hanya menampilkan `"Pertemuan " + p` tanpa simbol `#`.
   - Memperbaiki `loadAbsensiData` dengan fallback otomatis ke `getMasterSiswa` dan normalisasi field data siswa sehingga tabel siswa selalu terisi.
2. **`src/App.tsx`**:
   - Meneruskan prop `onNavigate` ke komponen `<Absensi />` agar tombol pada modal validasi dapat memindahkan tab pengguna secara mulus ke `master-siswa`.
3. **`src/services/gasApi.ts`**:
   - Memastikan respons simulasi lokal dan proxy payload untuk `getAbsensiData` menyertakan daftar siswa dari `getMasterSiswa` jika belum disertakan.
