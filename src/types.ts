export type PageId =
  | 'dashboard'
  | 'profil'
  | 'master-ajar'
  | 'master-siswa'
  | 'absensi'
  | 'nilai'
  | 'lkh'
  | 'laporan';

export interface User {
  userId: string;
  username: string;
  namaLengkap: string;
  namaTampilan: string;
  nip: string;
  jabatan: string;
  jabatanId?: string;
  gelarDepan?: string;
  gelarBelakang?: string;
  namaAtasan?: string;
  fotoUrl?: string;
  parafUrl?: string;
  tahunAjaran?: string;
}

export interface RefItem {
  id?: string;
  code?: string;
  name: string;
}

export interface ReferencesMap {
  GelarDepan: RefItem[];
  GelarBelakang: RefItem[];
  Jabatan: RefItem[];
  MataPelajaran: RefItem[];
  Mapel?: RefItem[];
  Kelas: RefItem[];
  UraianKerja?: RefItem[];
  Hasil?: RefItem[];
}

export interface DashboardData {
  tahunAjaran: string;
  totalKelas: number;
  totalMapel: number;
  totalSiswa: number;
}

export interface PengajaranItem {
  _rowIndex?: number;
  PengajaranID?: string;
  pengajaranId?: string;
  MPGID?: string;
  UserID?: string;
  userId?: string;
  TahunAjaran?: string;
  MataPelajaranID?: string;
  mapelId: string;
  mapelNama: string;
  Kelas?: string;
  kelas?: string;
  jenisMapel?: string;
  isUtama?: boolean;
}

export interface MapelGroup {
  mapelId: string;
  mapelNama: string;
  kelases: string[];
  isUtama?: boolean;
}

export interface MasterAjarData {
  success: boolean;
  waliKelas: string;
  mapelUtamaId: string;
  mapelUtamaNama?: string;
  mapelUtama: MapelGroup | null;
  mapelTambahan: MapelGroup[];
  pengajaran: PengajaranItem[];
  tahunAjaran: string;
  listKelas: RefItem[];
  listMapel: RefItem[];
}

export interface SiswaItem {
  _rowIndex?: number;
  SiswaID?: string;
  siswaId?: string;
  NIS?: string;
  nis?: string;
  nisn?: string;
  NamaSiswa?: string;
  namaSiswa?: string;
  nama?: string;
  Kelas?: string;
  kelas?: string;
  JenisKelamin?: string;
  jenisKelamin?: string;
  jk?: string;
  Status?: string;
}

export interface AbsensiRecord {
  AbsensiID?: string;
  SiswaID?: string;
  siswaId?: string;
  NIS?: string;
  NamaSiswa?: string;
  Kelas?: string;
  MataPelajaranID?: string;
  Semester?: string;
  Pertemuan?: number | string;
  Tanggal?: string;
  Status?: string; // H, S, I, A
}

export interface AbsensiDataResponse {
  success: boolean;
  siswa: SiswaItem[];
  absensiMap: Record<string, Record<string, string>>; // [siswaId][meetingNum]: 'H' | 'S' | 'I' | 'A'
  datesMap: Record<string, string>; // [meetingNum]: 'YYYY-MM-DD'
}

export interface NilaiDataResponse {
  success: boolean;
  siswa: SiswaItem[];
  aktivitasMap: Record<string, Record<string, number | null>>; // [siswaId][actKey]: number
  pasMap: Record<string, number | null>; // [siswaId]: number
  kkm?: number;
  bobotAct?: number;
  bobotPas?: number;
}

export interface LkhRecord {
  _rowIndex?: number;
  LkhID?: string;
  lkhId?: string;
  UserID?: string;
  Tanggal?: string;
  tanggal?: string;
  IsNonKbm?: boolean;
  isNonKbm?: boolean;
  MataPelajaranID?: string;
  mapelId?: string;
  mapelNama?: string;
  JamMulai?: number | string;
  jamMulai?: number | string;
  JamSelesai?: number | string;
  jamSelesai?: number | string;
  Kelas?: string;
  kelas?: string;
  UraianKerja?: string;
  uraian?: string;
  HasilPembelajaran?: string;
  hasil?: string;
  ParafUrl?: string;
  parafUrl?: string;
  CreatedAt?: string;
}

export interface LkhInitialData {
  success: boolean;
  listJam: string[];
  pengajaran: PengajaranItem[];
  listUraian: string[];
  listHasil: string[];
  userParafUrl?: string;
}
