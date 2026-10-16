# Rencana Implementasi: Alur Presensi Siswa Dinamis, Status Submitted & Isolasi Data Multi-Guru

Dokumen ini merinci rencana arsitektur dan pembaruan antarmuka pada fitur **Presensi Siswa** (`Absensi.tsx`) sesuai kebutuhan alur kerja guru di madrasah:
1. **Alur Pemilihan Pertemuan:** Tampilan awal mewajibkan guru memilih pertemuan terlebih dahulu. Kolom tanggal dan daftar siswa hanya akan muncul setelah pertemuan dipilih secara eksplisit.
2. **Status Submitted:** Jika pertemuan yang dipilih sudah pernah diisi dan disimpan, antarmuka otomatis menampilkan status *Submitted* dengan tombol Edit untuk membuka kunci jika guru memerlukan koreksi.
3. **Penanda Visual Dropdown Pertemuan:** Daftar dropdown pertemuan (1–31) menampilkan penanda visual jelas (`✓ Tersimpan` vs belum diisi).
4. **Isolasi Data Multi-Guru & Multi-Mata Pelajaran:** Menjamin data presensi kelas tidak tertukar antar-guru yang mengajar mata pelajaran berbeda di rombel yang sama melalui penguncian komposit (*composite key*).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Keputusan alur dan interaksi berikut telah dikonfirmasi oleh pengguna:
> - **Kebijakan Status Submitted:** Menyediakan tombol **Edit** bertema tactile Neumorphic untuk membuka kunci formulir jika guru perlu mengoreksi kehadiran siswa yang telah tersimpan.
> - **Indikator Dropdown Pertemuan:** Memberikan penanda visual khusus (misal: `Pertemuan 1 ✓ (Tersimpan)`) pada opsi pertemuan yang telah memiliki riwayat data tersimpan agar guru dapat langsung melihat progres pertemuan yang sudah tuntas.

---

## 1. Overview & Core Concept

- **Apa yang Diperbarui**:
  1. *Zero-Selection Initial State*: Saat guru mengeklik kartu rombel mengajar (misal: *Kelas XI.6 • Fikih*), lembar presensi terbuka dalam keadaan awal bersih. Dropdown pertemuan menampilkan placeholder `-- Pilih Pertemuan --`, kolom tanggal belum muncul, dan area data menampilkan instruksi ramah: *"Silakan pilih pertemuan terlebih dahulu untuk memuat lembar presensi."*
  2. *Dynamic Reveal on Meeting Selection*: Begitu guru memilih pertemuan (misal: Pertemuan 1):
     - Kolom tanggal presensi langsung dimunculkan (terisi otomatis dengan tanggal yang pernah disimpan, atau tanggal hari ini jika baru).
     - Daftar siswa kelas tersebut untuk mata pelajaran tersebut dimuat dan dirender.
     - Jika pertemuan tersebut sudah pernah disimpan, antarmuka menampilkan overlay/status **Submitted** (dengan tombol Edit untuk koreksi).
     - Jika pertemuan tersebut belum pernah diisi, formulir terbuka dalam mode aktif siap diisi (default Hadir dengan opsi tombol H/I/S/A).
  3. *Isolasi Data Absen per Mapel & Guru*:
     - Di MAN 1 Majalengka, satu kelas (misal XI.6) diajar oleh guru Fikih, guru Sejarah Kebudayaan Islam, guru Matematika, dll.
     - Kunci identifikasi penyimpanan presensi dirancang ketat:  
       `{kelas}_{mapelId}_{semester}_{tahunAjaran}_{guruNip}`
     - Menjamin presensi Fikih di XI.6 tidak akan pernah terhapus, tertimpa, atau terbaca oleh guru SKI atau guru lainnya.

---

## 2. User Experience & Visual Design

### A. Alur Tampilan Saat Rombel Dibuka (Pertemuan Belum Dipilih)
```
+----------------------------------------------------+
|  Kelas XI.6 • Fikih                   [X Tutup]   |
|  Semester Ganjil • T.A 2026/2027                   |
+----------------------------------------------------+
|  Pertemuan Ke:                                     |
|  [ -- Pilih Pertemuan (1 - 31) --               v ]|  <- Dropdown Wajib Pilih
+----------------------------------------------------+
|                                                    |
|           [ Ikon Kalender / Presensi ]             |
|             Silakan Pilih Pertemuan                |  <- State Petunjuk Awal
|  Pilih nomor pertemuan di atas untuk menampilkan   |
|  tanggal presensi dan daftar kehadiran siswa.      |
|                                                    |
+----------------------------------------------------+
```

### B. Tampilan Setelah Pertemuan Dipilih (Data Muncul)
```
+----------------------------------------------------+
|  Kelas XI.6 • Fikih                   [X Tutup]   |
+----------------------------------------------------+
|  Pertemuan Ke:            Tanggal Presensi:        |
|  [ Pertemuan 1          v ] [ 16/10/2026         ] |  <- Tanggal Muncul Dinamis
+----------------------------------------------------+
|  [ Hadir Semua ]         H: 34 | I: 1 | S: 1 | A: 0|  <- Baris Kontrol Aktif
+----------------------------------------------------+
|  No.  Nama Siswa                     Kehadiran     |
|  1.   Achmad Dani Ramadhan           [H] [I] [S] [A]
|  2.   Aisyah Putri Nurhaliza         [H] [I] [S] [A]
|  ...  ...                                          |
+----------------------------------------------------+
|  [       Simpan Presensi Pertemuan ke-1          ] |  <- Tombol Simpan
+----------------------------------------------------+
```

### C. Tampilan Jika Pertemuan Sudah Tersimpan (Submitted State)
- Pada baris pilihan dropdown: `Pertemuan 1 ✓ (Tersimpan)`.
- Pada area tabel siswa: Muncul kartu status Neumorphic elegan:
  - Ikon checklist hijau `CheckCircle2`
  - Teks: **`Submitted`** — *Pertemuan 1 telah tersimpan pada 16/10/2026*
  - Tombol tactile: **`Edit Presensi`** untuk membuka kunci jika guru ingin mengubah kehadiran salah satu siswa.

---

## 3. Key Product Decisions & Trade-Offs

- **Keputusan 1: Pertemuan Dimulai dari Status Kosong (`selectedMeeting = null`)**
  - *Pendekatan*: Tidak melakukan auto-select ke Pertemuan 1 secara otomatis saat modal pertama dibuka.
  - *Alasan*: Mencegah guru salah memasukkan absen ke pertemuan 1 secara tidak sengaja ketika sebenarnya guru hendak mengisi pertemuan 3 atau 4.
- **Keputusan 2: Penandaan Riwayat Pertemuan Tersimpan**
  - *Pendekatan*: Melakukan pemindaian lokal/server terhadap pertemuan yang telah memiliki catatan tanggal atau absensi pada rombel tersebut, lalu membubuhkan label `✓ (Tersimpan)` pada opsi select.
  - *Alasan*: Memberikan kepastian langsung kepada guru mengenai pertemuan mana saja yang sudah selesai dicatat.
- **Keputusan 3: Komposit Key Database & Cache**
  - *Pendekatan*: Setiap panggilan API `getAbsensiData` dan `saveAbsensiData` menyertakan `mapelId` dan `kelas` secara tegas. Cache penyimpanan lokal menggunakan prefix `ajar_absensi_${kelas}_${mapelId}_${semester}`.
  - *Alasan*: Menjamin integritas data madrasah 100% aman dari konflik antar-guru.

---

## 4. Technical Architecture & Component Mapping

```
┌─────────────────────────────────────────────────────────────┐
│                          App.tsx                            │
│  - Meneruskan prop currentUser ke Absensi.tsx               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                        Absensi.tsx                          │
├─────────────────────────────────────────────────────────────┤
│ 1. State:                                                   │
│    - selectedPertemuan: number | null (default: null)       │
│    - savedMeetingsMap: Record<number, { tanggal, isSaved }> │
│    - isLocked: boolean (true jika pertemuan sudah saved)    │
├─────────────────────────────────────────────────────────────┤
│ 2. View Rendering Logic:                                    │
│    - IF selectedPertemuan === null:                         |
│        Render Dropdown Pertemuan + "Pilih Pertemuan State"  │
│        (Tanggal & Tabel Siswa Tersembunyi)                  │
│    - IF selectedPertemuan !== null:                         │
│        Render Tanggal Input + Tabel Siswa                   │
│        IF isSaved -> Render Status Submitted + Tombol Edit  │
├─────────────────────────────────────────────────────────────┤
│ 3. Data Isolation Service (gasApi.ts & Local Storage):      │
│    - Key: ajar_absensi_${kelas}_${mapelId}_${semester}      │
│    - Payload saveAbsensiData menyertakan:                   │
│      mapelId, kelas, pertemuan, tanggal, semester, guruNip  │
└─────────────────────────────────────────────────────────────┘
```

### Rincian Rencana Eksekusi:
1. **`src/App.tsx`**:
   - Teruskan `currentUser={currentUser}` ke komponen `<Absensi />`.
2. **`src/components/Absensi.tsx`**:
   - Ubah initial state `pertemuan` menjadi `null` saat rombel baru dibuka.
   - Tambahkan state `savedMeetings` untuk mencatat nomor-nomor pertemuan yang sudah pernah disimpan pada rombel tersebut.
   - Sembunyikan input tanggal dan tabel siswa sebelum pertemuan dipilih; tampilkan kartu panduan Neumorphic *"Silakan Pilih Pertemuan"*.
   - Saat pertemuan dipilih:
     - Tampilkan tanggal dan data siswa.
     - Periksa apakah pertemuan tersebut sudah tersimpan; jika ya, aktifkan mode `Submitted` (terkunci dengan opsi tombol Edit).
   - Di dropdown pertemuan: Beri penanda `✓` pada pertemuan yang sudah diisi.
   - Pastikan isolasi data: Sertakan `mapelId`, `kelas`, `semester`, dan `currentUser.nip` pada penyimpanan dan payload GAS.
3. **`src/services/gasApi.ts`**:
   - Selaraskan penanganan fallback `getAbsensiData` dan `saveAbsensiData` agar menggunakan key gabungan `kelas + mapelId + semester`.
4. **Verifikasi Build**:
   - Jalankan `compile_applet` dan `lint_applet` untuk menjamin tidak ada error sintaks atau regresi tipe data.
