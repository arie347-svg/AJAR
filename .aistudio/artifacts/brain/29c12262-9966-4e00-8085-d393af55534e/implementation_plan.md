# Rencana Implementasi: Format Dokumen Hasil Download LKH Sesuai Contoh Resmi & Mata Pelajaran Utama

Rencana implementasi ini menyelaraskan tampilan hasil unduhan file **Laporan Kinerja Harian (LKH)** pada aplikasi agar identik dengan dokumen contoh `LKH_Yuni_1Sep2026-30Sep2026.pdf`, serta memastikan atribut **Mata Pelajaran** pada sampul dan identitas laporan selalu diisi dengan **Mata Pelajaran Utama** guru terkait.

---

## 1. Resolusi Otomatis Mata Pelajaran Utama Guru
- Meneruskan informasi `masterAjarData` (atau mengekstrak langsung dari `pengajaranList` yang berstatus `isUtama === true` serta fallback `masterAjarData.mapelUtama` / cache lokal `ajar_master_ajar_*`) ke modul pembuat laporan di `src/components/Laporan.tsx` (dan `src/App.tsx`).
- Menyediakan helper `resolvePrimaryMapelName()` yang selalu mengembalikan nama **Mata Pelajaran Utama** guru (misalnya `Matematika`, `Fikih`, dll.) untuk ditampilkan pada:
  1. **Halaman Sampul (Cover)** bagian `MATA PELAJARAN : <Mata Pelajaran Utama>`.
  2. **Header Identitas Halaman Tabel** bagian `Mata Pelajaran : <Mata Pelajaran Utama>`.

---

## 2. Struktur & Tata Letak Hasil Download LKH (Sesuai Contoh PDF)

Dokumen LKH menggunakan ukuran kertas **A4 Portrait (`210mm x 297mm`)** dengan tipografi formal serif (`Times` / `Times New Roman`):

### A. Halaman 1 — Halaman Sampul (Cover)
1. **Judul Atas (Rata Tengah, Huruf Kapital, Tebal):**
   - `LAPORAN KINERJA HARIAN`
   - `GURU MADRASAH ALIYAH NEGERI 1 MAJALENGKA`
   - `PERIODE BULAN <NAMA BULAN> TAHUN <TAHUN>` (otomatis mengikuti periode tanggal yang dipilih, misal `PERIODE BULAN SEPTEMBER TAHUN 2026`).
2. **Logo Kementerian Agama & Subjudul Tengah:**
   - Menampilkan logo resmi **Kementerian Agama ("Ikhlas Beramal")** secara terpusat di tengah halaman (dirender menggunakan kanvas vektor resolusi tinggi agar tajam di PDF dan Word).
   - Tepat di bawah logo tertulis **`KEMENTERIAN AGAMA`** (tebal, rata tengah).
3. **Blok Identitas Guru pada Sampul (Rata Tengah dengan Titik Dua Sejajar):**
   - `NAMA           : <Nama Lengkap & Gelar Guru>`
   - `NIP            : <NIP Guru>`
   - `MATA PELAJARAN : <Mata Pelajaran Utama>`
4. **Kaki Sampul / Instansi Bawah (Rata Tengah, Huruf Kapital, Tebal):**
   - `KEMENTERIAN AGAMA REPUBLIK INDONESIA`
   - `KANTOR KEMENTERIAN AGAMA KABUPATEN MAJALENGKA`
   - `MADRASAH ALIYAH NEGERI 1 MAJALENGKA`
   - `<TAHUN>` (misal `2026`)

### B. Halaman 2 dst. — Halaman Isi Tabel Laporan Kinerja Harian
1. **Judul & Identitas Laporan:**
   - Judul rata tengah tebal: **`LAPORAN KINERJA HARIAN`**
   - Blok identitas rata kiri di atas tabel:
     - `Nama           : <Nama Lengkap & Gelar Guru>`
     - `NIP            : <NIP Guru>`
     - `Jabatan        : <Jabatan Guru>`
     - `Mata Pelajaran : <Mata Pelajaran Utama>`
     - `Periode        : Bulan <Nama Bulan> Tahun <Tahun>`
2. **Tabel Utama LKH (6 Kolom & Aturan Merge):**
   - Header kolom dengan latar abu-abu muda (`#E5E7EB`), teks tebal rata tengah, dan garis tabel hitam tegas:
     - `No.` | `Hari / Tanggal` | `Jam Ke` | `Kelas` | `Uraian Kegiatan / Tugas` | `Hasil / Output`
   - **Penggabungan Vertikal (`rowSpan`) per Tanggal:**
     - Kolom `No.` (nomor urut per tanggal unik: `1`, `2`, `3`, dst.) dan `Hari / Tanggal` (format `Selasa, 1 Sep 2026`) digabung (`rowSpan`) untuk seluruh kegiatan pada tanggal yang sama.
   - **Penggabungan Horizontal (`colSpan`) untuk Kegiatan Non-KBM:**
     - **Non-KBM tanpa Jam Ke** (misal hari libur nasional/madrasah): digabung dari kolom **`Jam Ke` s/d `Hasil / Output` (`colSpan = 4`)**, cetak miring (*italic*), rata tengah, dengan latar abu-abu lembut (`#F3F4F6`).
     - **Non-KBM dengan Jam Ke** (misal rapat koordinasi / upacara pada jam tertentu): kolom `Jam Ke` menampilkan rentang jam (`5-6` atau `1-2`), sedangkan kolom **`Kelas` s/d `Hasil / Output` digabung (`colSpan = 3`)**.
3. **Blok Pengesahan / Tanda Tangan di Bawah Tabel:**
   - **Kolom Kiri:**
     - `Mengetahui,`
     - `Kepala MAN 1 Majalengka`
     - Ruang tanda tangan
     - Nama Kepala Madrasah / Atasan (tebal & bergaris bawah) beserta `NIP.`
   - **Kolom Kanan:**
     - `Majalengka, <Tanggal Akhir Periode Format Lengkap>` (misal `Majalengka, 30 September 2026`)
     - `Guru Mata Pelajaran`
     - Ruang tanda tangan (menyertakan gambar paraf/tanda tangan guru jika tersedia)
     - Nama Lengkap Guru (tebal & bergaris bawah) beserta `NIP. <NIP Guru>`

---

## 3. File yang Akan Dimodifikasi / Ditambahkan
1. **`src/utils/lkhExportDocument.ts` *(File Baru)***:
   - Generator logo resmi Kementerian Agama (`Ikhlas Beramal`) berbasis Canvas Data URL.
   - Fungsi ekspor **PDF LKH (`exportLkhOfficialPdf`)** menggunakan `jsPDF` + `jspdf-autotable` (Portrait A4, font `times`, halaman sampul + halaman isi tabel dengan `rowSpan`/`colSpan` + blok tanda tangan).
   - Fungsi ekspor **Word LKH (`exportLkhOfficialWord`)** dan **Excel LKH (`exportLkhOfficialExcel`)** dengan struktur sampul, identitas Mata Pelajaran Utama, penggabungan sel tabel, dan blok tanda tangan yang selaras.
2. **`src/App.tsx` & `src/components/Laporan.tsx`**:
   - Meneruskan `masterAjarData` ke `Laporan` agar resolusi **Mata Pelajaran Utama** selalu akurat baik dari state utama, daftar pengajaran, maupun penyimpanan lokal.
   - Menghubungkan tombol **Download** pada kategori **LKH** (PDF, Word, Excel) ke generator dokumen resmi `lkhExportDocument.ts`.
