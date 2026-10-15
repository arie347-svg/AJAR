# AJAR - MAN 1 Majalengka

**Aplikasi Jurnal dan Administrasi Pembelajaran - MAN 1 Majalengka**

Aplikasi administrasi pembelajaran modern dan jurnal harian guru (LKH) berbasis React, TypeScript, Tailwind CSS, dan Express API Gateway.

## Fitur Utama

1. **Autentikasi & Akun Guru**
   - Login menggunakan NIP / Username dan Password
   - Registrasi akun guru baru lengkap dengan Gelar Depan, Belakang, NIP, dan Jabatan
   - Tombol Uji Coba Cepat (Akun Demo) untuk preview instan
   - Ingat sesi masuk dan auto-renewal

2. **Master Ajar & Data Siswa**
   - Penetapan tugas tambahan Wali Kelas
   - Pemilihan Mata Pelajaran Utama dengan pemilihan rombel/kelas interaktif
   - Manajemen Mata Pelajaran Tambahan dinamis
   - Kelola data siswa per kelas (Tambah, Edit, Hapus)
   - Ekspor template Excel dan Unggah data siswa secara massal (Bulk Upload XLSX)

3. **Presensi Siswa (Absensi)**
   - Pilihan filter Mata Pelajaran, Kelas, dan Semester (Ganjil/Genap)
   - Pertemuan Ke-1 hingga Ke-31 dengan tanggal fleksibel
   - Aksi cepat "Semua Hadir (H)"
   - Status presensi individual (Hadir, Sakit, Izin, Alpa)

4. **Penilaian Siswa (Ledger Nilai)**
   - Input nilai Aktivitas Formatif 1 hingga 16 dan Ujian Akhir Semester (PAS)
   - Validasi nilai 0-100 dan perhitungan rata-rata otomatis

5. **Jurnal LKH (Conversational Stepper Wizard)**
   - 8-Langkah pengisian terpandu (Tanggal, Klasifikasi KBM vs Non-KBM, Mapel, Jam, Kelas, Uraian Tugas dengan Saran Pintar, Hasil Ketercapaian, Review & Paraf Digital)
   - Tab Riwayat Jurnal LKH yang tersimpan

6. **Export Laporan**
   - Rekapitulasi Presensi (Matriks), Penilaian (Ledger Nilai dengan KKM & Bobot), dan Jurnal LKH
   - Format ekspor: Excel (.xlsx), Word (.doc), dan PDF resmi lengkap dengan Kop Madrasah dan Tanda Tangan/Paraf Digital

7. **Profil Guru & Digital Signature**
   - Unggah foto profil dan paraf tanda tangan digital
   - Edit Nama Lengkap, Gelar, Jabatan, Atasan Langsung, dan Password

## Menjalankan Proyek

```bash
# Menjalankan server pengembangan (Port 3000)
npm run dev

# Membangun aplikasi produksi
npm run build

# Menjalankan di lingkungan produksi
npm run start
```
