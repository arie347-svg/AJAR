import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen,
  Briefcase,
  CalendarDays,
  Clock,
  PlusCircle,
  Save,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Check,
  Edit3,
  Eye,
  Filter,
  X,
  FileText,
  Layers,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { LkhRecord, PengajaranItem, ReferencesMap, User } from '../types';
import { callGasApi, DEFAULT_REFERENCES } from '../services/gasApi';
import {
  exportLkhOfficialPdf,
  buildOfficialLkhFilename,
  resolvePrimaryMapelName,
} from '../utils/lkhExportDocument';

interface LkhWizardProps {
  token: string;
  currentUser: User | null;
  pengajaranList: PengajaranItem[];
  references?: ReferencesMap;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onNavigate?: (page: any) => void;
}

const DEFAULT_SUGGESTIONS_URAIAN_KBM = [
  'Melaksanakan kegiatan pembelajaran materi pokok sesuai modul ajar',
  'Memberikan bimbingan diskusi kelompok dan praktikum siswa',
  'Melaksanakan asesmen formatif harian dan pembahasan evaluasi soal',
  'Melakukan pendampingan remedi dan pengayaan materi peserta didik',
  'Memfasilitasi presentasi hasil proyek dan tanya jawab kelas',
];

const DEFAULT_SUGGESTIONS_URAIAN_NON_KBM = [
  "Mengikuti pembiasaan tadarus Al-Qur'an dan sholat dhuha berjamaah",
  'Menghadiri rapat dinas koordinasi evaluasi kurikulum madrasah',
  'Melaksanakan piket harian dan pendampingan ketertiban madrasah',
  'Menyusun perangkat pembelajaran, modul ajar, dan instrumen asesmen',
  'Melaksanakan tugas kedinasan luar / kegiatan pengembangan diri guru',
];

const DEFAULT_SUGGESTIONS_HASIL = [
  '1 LKH',
  '1 Kegiatan',
  'Siswa memahami materi dengan baik dan aktif berdiskusi',
  'Seluruh peserta didik menyelesaikan tugas asesmen formatif tepat waktu',
  'Tercapai ketuntasan tujuan pembelajaran sesuai target modul ajar',
];

const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const SHORT_MONTH_NAMES_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const DAY_HEADERS_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const DAY_NAMES_ID = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Normalisasi Tanggal dari Sheet 09_LKH menjadi format YYYY-MM-DD yang presisi.
 * Menangani string '2026-03-04', timestamp ISO UTC dari Google Sheets ('2026-03-03T17:00:00.000Z' -> '2026-03-04' WIB),
 * maupun format DD/MM/YYYY.
 */
function normalizeIsoDate(dateVal: unknown): string {
  if (!dateVal) return '';
  const clean = String(dateVal).trim();
  if (!clean) return '';

  // 1. Jika string murni YYYY-MM-DD tanpa komponen waktu T
  const plainIsoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (plainIsoMatch) {
    return `${plainIsoMatch[1]}-${plainIsoMatch[2].padStart(2, '0')}-${plainIsoMatch[3].padStart(2, '0')}`;
  }

  // 2. Jika berupa ISO timestamp dengan 'T' (misal hasil serialisasi Date object Google Sheets UTC)
  if (clean.includes('T')) {
    const parsedDate = new Date(clean);
    if (!isNaN(parsedDate.getTime())) {
      try {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Jakarta',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(parsedDate);
        const y = parts.find(p => p.type === 'year')?.value;
        const m = parts.find(p => p.type === 'month')?.value;
        const d = parts.find(p => p.type === 'day')?.value;
        if (y && m && d) {
          return `${y}-${m}-${d}`;
        }
      } catch {}
      const y = parsedDate.getFullYear();
      const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const d = String(parsedDate.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // 3. Jika diawali YYYY-MM-DD beserta jam spasi (misal '2026-03-04 00:00:00')
  const prefixIsoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (prefixIsoMatch) {
    return `${prefixIsoMatch[1]}-${prefixIsoMatch[2].padStart(2, '0')}-${prefixIsoMatch[3].padStart(2, '0')}`;
  }

  // 4. Jika format DD/MM/YYYY atau DD-MM-YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }

  const fallbackDate = new Date(clean);
  if (!isNaN(fallbackDate.getTime())) {
    const y = fallbackDate.getFullYear();
    const m = String(fallbackDate.getMonth() + 1).padStart(2, '0');
    const d = String(fallbackDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
}

/**
 * Evaluasi kolom HariNonKBM dari Sheet 09_LKH ('TRUE', 'FALSE', boolean true/false)
 */
function parseHariNonKbm(rawVal: unknown): boolean {
  if (typeof rawVal === 'boolean') return rawVal;
  if (typeof rawVal === 'number') return rawVal === 1;
  if (typeof rawVal === 'string') {
    const upper = rawVal.trim().toUpperCase();
    if (upper === 'TRUE' || upper === '1' || upper === 'YA' || upper === 'NON-KBM') {
      return true;
    }
    if (upper === 'FALSE' || upper === '0' || upper === 'TIDAK' || upper === 'KBM' || upper === '') {
      return false;
    }
  }
  return false;
}

/**
 * Normalisasi kolom JamKe dari Sheet 09_LKH (misal '1-2', '3-4', '5', atau kosong)
 */
function parseJamKeField(raw: any): {
  jamKeStr: string;
  jamMulai: number | '';
  jamSelesai: number | '';
} {
  const rawJamKe = raw?.JamKe ?? raw?.jamKe ?? '';
  const rawMulai = raw?.JamMulai ?? raw?.jamMulai ?? '';
  const rawSelesai = raw?.JamSelesai ?? raw?.jamSelesai ?? '';

  const hasMulai =
    rawMulai !== '' && rawMulai !== null && rawMulai !== undefined && !isNaN(Number(rawMulai));
  const hasSelesai =
    rawSelesai !== '' &&
    rawSelesai !== null &&
    rawSelesai !== undefined &&
    !isNaN(Number(rawSelesai));

  const strJamKe = String(rawJamKe ?? '').trim();
  if (strJamKe) {
    const nums = strJamKe.match(/\d+/g);
    if (nums && nums.length >= 2) {
      const m = parseInt(nums[0], 10);
      const s = parseInt(nums[1], 10);
      return {
        jamKeStr: m === s ? `${m}` : `${m}-${s}`,
        jamMulai: isNaN(m) ? '' : m,
        jamSelesai: isNaN(s) ? '' : s,
      };
    }
    if (nums && nums.length === 1) {
      const m = parseInt(nums[0], 10);
      if (hasSelesai) {
        const s = Number(rawSelesai);
        return {
          jamKeStr: m === s ? `${m}` : `${m}-${s}`,
          jamMulai: m,
          jamSelesai: s,
        };
      }
      return {
        jamKeStr: `${m}`,
        jamMulai: isNaN(m) ? '' : m,
        jamSelesai: '',
      };
    }
    return {
      jamKeStr: strJamKe,
      jamMulai: hasMulai ? Number(rawMulai) : '',
      jamSelesai: hasSelesai ? Number(rawSelesai) : '',
    };
  }
  if (hasMulai && hasSelesai) {
    const m = Number(rawMulai);
    const s = Number(rawSelesai);
    return {
      jamKeStr: m === s ? `${m}` : `${m}-${s}`,
      jamMulai: m,
      jamSelesai: s,
    };
  }
  if (hasMulai) {
    return {
      jamKeStr: `${rawMulai}`,
      jamMulai: Number(rawMulai),
      jamSelesai: '',
    };
  }
  if (hasSelesai) {
    return {
      jamKeStr: `${rawSelesai}`,
      jamMulai: '',
      jamSelesai: Number(rawSelesai),
    };
  }

  return { jamKeStr: '', jamMulai: '', jamSelesai: '' };
}

/**
 * Urutan Jam Ke untuk penyortiran baris LKH pada tanggal yang sama.
 * Jika jam ke tidak diisi:
 * - Non-KBM diurutkan paling atas (-2)
 * - Baris tanpa jam lainnya (-1)
 * - Jam 0, 1, 2, ...
 */
function getRecordJamSortOrder(rec: LkhRecord): number {
  const isNonKbm = parseHariNonKbm(
    rec.HariNonKBM ?? rec.IsNonKbm ?? rec.isNonKbm
  );
  const { jamMulai } = parseJamKeField(rec);
  if (jamMulai !== '' && !isNaN(Number(jamMulai))) {
    return Number(jamMulai);
  }
  return isNonKbm ? -2 : -1;
}

/**
 * Normalisasi baris data dari Sheet 09_LKH sesuai 14 header kolom:
 * LKHID, UserID, TahunAjaran, Tanggal, MataPelajaranID, JamKe, Kelas,
 * UraianKerja, Hasil, HariNonKBM, ParafGuruFileID, ParafGuruURL, CreatedAt, UpdatedAt
 */
function normalizeSheet09LkhRecord(raw: any, indexFallback = 0): LkhRecord {
  if (!raw || typeof raw !== 'object') {
    return { LKHID: `LKH-FALLBACK-${indexFallback}` };
  }

  const lkhIdVal = String(
    raw.LKHID || raw.LkhID || raw.lkhId || raw.id || ''
  ).trim();
  const userIdVal = String(
    raw.UserID || raw.userId || raw.guruId || raw.guruNip || raw.NIP || ''
  ).trim();
  const tahunAjaranVal = String(
    raw.TahunAjaran || raw.tahunAjaran || ''
  ).trim();
  const tanggalIso = normalizeIsoDate(
    raw.Tanggal ?? raw.tanggal ?? raw.Date ?? raw.date ?? ''
  );
  const mapelIdVal = String(
    raw.MataPelajaranID ?? raw.mapelId ?? raw.mataPelajaranId ?? ''
  ).trim();

  const { jamKeStr, jamMulai, jamSelesai } = parseJamKeField(raw);

  const rawKelas = String(raw.Kelas ?? raw.kelas ?? '').trim();
  const kelasVal = rawKelas === 'Non-KBM' || rawKelas === '-' ? '' : rawKelas;

  const uraianVal = String(
    raw.UraianKerja ?? raw.uraianKerja ?? raw.uraian ?? ''
  ).trim();
  const hasilVal = String(
    raw.Hasil ?? raw.hasil ?? raw.HasilPembelajaran ?? raw.hasilPembelajaran ?? ''
  ).trim();

  const nonKbmRaw =
    raw.HariNonKBM ??
    raw.hariNonKBM ??
    raw.hariNonKbm ??
    raw.IsNonKbm ??
    raw.isNonKbm;
  const isNonKbmBool = parseHariNonKbm(nonKbmRaw);

  const parafFileIdVal = String(
    raw.ParafGuruFileID ?? raw.parafGuruFileId ?? raw.ParafFileID ?? ''
  ).trim();
  const parafUrlVal = String(
    raw.ParafGuruURL ?? raw.parafGuruUrl ?? raw.ParafUrl ?? raw.parafUrl ?? ''
  ).trim();

  const createdAtVal = String(raw.CreatedAt ?? raw.createdAt ?? '').trim();
  const updatedAtVal = String(raw.UpdatedAt ?? raw.updatedAt ?? '').trim();

  const computedId =
    lkhIdVal ||
    `${userIdVal}_${tanggalIso}_${mapelIdVal}_${jamKeStr}_${kelasVal}_${indexFallback}`;

  return {
    ...raw,
    LKHID: computedId,
    LkhID: computedId,
    lkhId: computedId,
    UserID: userIdVal,
    userId: userIdVal,
    TahunAjaran: tahunAjaranVal,
    tahunAjaran: tahunAjaranVal,
    Tanggal: tanggalIso,
    tanggal: tanggalIso,
    MataPelajaranID: mapelIdVal,
    mapelId: mapelIdVal,
    JamKe: jamKeStr,
    jamKe: jamKeStr,
    JamMulai: jamMulai,
    jamMulai: jamMulai,
    JamSelesai: jamSelesai,
    jamSelesai: jamSelesai,
    Kelas: kelasVal,
    kelas: kelasVal,
    UraianKerja: uraianVal,
    uraianKerja: uraianVal,
    uraian: uraianVal,
    Hasil: hasilVal,
    hasil: hasilVal,
    HasilPembelajaran: hasilVal,
    HariNonKBM: isNonKbmBool,
    hariNonKBM: isNonKbmBool,
    hariNonKbm: isNonKbmBool,
    IsNonKbm: isNonKbmBool,
    isNonKbm: isNonKbmBool,
    ParafGuruFileID: parafFileIdVal,
    parafGuruFileId: parafFileIdVal,
    ParafGuruURL: parafUrlVal,
    parafGuruUrl: parafUrlVal,
    ParafUrl: parafUrlVal,
    parafUrl: parafUrlVal,
    CreatedAt: createdAtVal,
    createdAt: createdAtVal,
    UpdatedAt: updatedAtVal,
    updatedAt: updatedAtVal,
  };
}

function formatShortDateId(dateStr: string): string {
  if (!dateStr) return '-';
  const norm = normalizeIsoDate(dateStr);
  const isoMatch = norm.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const monthIdx = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${SHORT_MONTH_NAMES_ID[monthIdx]} ${year}`;
    }
  }
  return dateStr;
}

/**
 * Format Tanggal untuk kolom Tgl di Preview Rekap LKH dengan Nama Hari di awalnya
 * Contoh: "Senin, 1 Sep 2026"
 */
function formatPreviewDateWithDayId(dateStr: string): string {
  if (!dateStr) return '-';
  const norm = normalizeIsoDate(dateStr);
  const isoMatch = norm.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const monthIdx = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    if (monthIdx >= 0 && monthIdx < 12) {
      const dateObj = new Date(year, monthIdx, day);
      const dayName = DAY_NAMES_ID[dateObj.getDay()] || '';
      return `${dayName}, ${day} ${SHORT_MONTH_NAMES_ID[monthIdx]} ${year}`;
    }
  }
  return dateStr;
}

function buildCalendarCells(
  year: number,
  month: number
): Array<{ day: number | null; isoDate: string }> {
  const firstDayOfMonth = new Date(year, month, 1);
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ day: number | null; isoDate: string }> = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: null, isoDate: '' });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    cells.push({ day: d, isoDate: `${year}-${mStr}-${dStr}` });
  }
  return cells;
}

type ActiveFloatingModal =
  | null
  | 'mapel'
  | 'kelas'
  | 'jamKe'
  | 'uraian'
  | 'hasil'
  | 'rekapRangeDate'
  | 'rekapMapelFilter';

export const LkhWizard: React.FC<LkhWizardProps> = ({
  token,
  currentUser,
  pengajaranList,
  references,
  showToast,
  onNavigate,
}) => {
  // Tab Switcher: 'form' (Formulir Jurnal) vs 'rekap' (Rekap LKH)
  const [activeTab, setActiveTab] = useState<'form' | 'rekap'>('form');

  // Wizard Step (1..4)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Mode Edit dari Rekap LKH (menyimpan LKHID record yang sedang diedit jika ada)
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  // Panel Mengambang (Floating Modal)
  const [activeModal, setActiveModal] = useState<ActiveFloatingModal>(null);

  // Form State
  const [isNonKbm, setIsNonKbm] = useState<boolean>(false);
  const [tanggal, setTanggal] = useState<string>(() => getTodayIso());
  const [calendarViewDate, setCalendarViewDate] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Mata Pelajaran dan Kelas DIPISAH pada Formulir Jurnal
  const [mapelId, setMapelId] = useState<string>('');
  const [mapelNama, setMapelNama] = useState<string>('');
  const [kelas, setKelas] = useState<string>('');

  // Pilihan Jam Ke (Opsional / Available tidak diisi)
  const [jamMulai, setJamMulai] = useState<number | ''>('');
  const [jamSelesai, setJamSelesai] = useState<number | ''>('');

  // Uraian Aktivitas & Hasil
  const [uraian, setUraian] = useState<string>('');
  const [hasil, setHasil] = useState<string>('');

  // Reset seluruh isian formulir aktif jika batal atau ingin membersihkan formulir
  const handleResetForm = () => {
    setWizardStep(1);
    setIsNonKbm(false);
    setTanggal(getTodayIso());
    const now = new Date();
    setCalendarViewDate({ year: now.getFullYear(), month: now.getMonth() });
    setMapelId('');
    setMapelNama('');
    setKelas('');
    setJamMulai('');
    setJamSelesai('');
    setUraian('');
    setHasil('');
    setActiveModal(null);
    setEditingRecordId(null);
    showToast('Formulir jurnal berhasil dibersihkan.', 'info');
  };

  // State Rekap LKH & Filter (Data 09_LKH sesuai UserID guru terkait)
  const [historyRecords, setHistoryRecords] = useState<LkhRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter Rekap LKH: Rentang Tanggal (2 Sisi Kalender sesuai 09_LKH) & Filter Mata Pelajaran
  const [rekapStartDate, setRekapStartDate] = useState<string>('');
  const [rekapEndDate, setRekapEndDate] = useState<string>('');
  const [rekapMapelFilter, setRekapMapelFilter] = useState<string>(''); // '' (belum ditentukan), 'ALL' (Semua), atau MataPelajaranID
  const [isRekapPreviewed, setIsRekapPreviewed] = useState<boolean>(false);
  const [isRekapEditMode, setIsRekapEditMode] = useState<boolean>(false);

  // State Kalender 2 Sisi untuk Filter Rentang Tanggal Rekap LKH
  const [leftCalView, setLeftCalView] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [rightCalView, setRightCalView] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // State Baris Terpilih untuk Mode Edit (tekan 2x / multi-pilih untuk hapus)
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [isDeletingBatch, setIsDeletingBatch] = useState<boolean>(false);
  const lastTapRef = useRef<{ rowId: string; time: number } | null>(null);

  // Identitas UserID guru terkait (prioritaskan UserID dari sheet 01_Users / 09_LKH)
  const guruUserId = useMemo(() => {
    return String(
      currentUser?.userId ||
        (currentUser as any)?.UserID ||
        currentUser?.nip ||
        currentUser?.username ||
        ''
    ).trim();
  }, [currentUser]);

  const guruIdentifier = useMemo(() => {
    return guruUserId || token || '';
  }, [guruUserId, token]);

  const scopedStorageKey = useMemo(() => {
    return guruIdentifier ? `ajar_lkh_records_${guruIdentifier}` : 'ajar_lkh_records';
  }, [guruIdentifier]);

  // Daftar kandidat identitas milik guru yang sedang login untuk pencocokan kolom UserID pada 09_LKH
  const currentTeacherCandidateIds = useMemo(() => {
    if (!currentUser) return [] as string[];
    const rawList = [
      currentUser.userId,
      (currentUser as any).UserID,
      currentUser.nip,
      currentUser.username,
    ];
    // Ambil juga dari pengajaranList jika pengajaranList menyimpan UserID asli dari sheet 04_MapelGuru
    pengajaranList.forEach(p => {
      if (p.UserID) rawList.push(p.UserID);
      if (p.userId) rawList.push(p.userId);
    });
    return Array.from(
      new Set(
        rawList
          .filter(Boolean)
          .map(v => String(v).trim().toLowerCase())
      )
    );
  }, [currentUser, pengajaranList]);

  // Fungsi pengecekan apakah baris 09_LKH adalah milik UserID guru terkait
  const belongsToCurrentGuru = (rec: LkhRecord): boolean => {
    if (!currentUser) return true;
    const recUserId = String(rec.UserID || rec.userId || '').trim().toLowerCase();
    if (!recUserId) return true;
    if (currentTeacherCandidateIds.length === 0) return true;
    return currentTeacherCandidateIds.includes(recUserId);
  };

  // Memuat semua data LKH dari Sheet 09_LKH yang sesuai dengan UserID guru terkait
  const loadHistory = async () => {
    setLoadingHistory(true);
    let localRecords: LkhRecord[] = [];
    try {
      const rawScoped = localStorage.getItem(scopedStorageKey);
      const parsedScoped = rawScoped ? JSON.parse(rawScoped) : [];

      if (Array.isArray(parsedScoped) && parsedScoped.length > 0) {
        const normalizedLocal = parsedScoped
          .map((r, idx) => normalizeSheet09LkhRecord(r, idx))
          .filter(r => Boolean(r.Tanggal) && belongsToCurrentGuru(r));

        const dedupLocal = new Map<string, LkhRecord>();
        normalizedLocal.forEach(r => {
          const key = r.LKHID || r.LkhID || `${r.Tanggal}_${r.JamKe}_${r.Kelas}`;
          if (!dedupLocal.has(key)) {
            dedupLocal.set(key, r);
          }
        });
        localRecords = Array.from(dedupLocal.values());
        if (localRecords.length > 0) {
          setHistoryRecords(localRecords);
        }
      }

      const activeToken = localStorage.getItem('ajar_token') || token;
      const res = await callGasApi<any>('getLkhData', [activeToken, guruIdentifier]);

      // GAS getLkhData mengembalikan array baris 09_LKH pada properti res.data (atau res.records)
      const rawServerArray = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.records)
        ? res.records
        : Array.isArray(res?.lkh)
        ? res.lkh
        : null;

      if (res && res.success && rawServerArray) {
        const allNormalizedServer = rawServerArray
          .map((r: any, idx: number) => normalizeSheet09LkhRecord(r, idx))
          .filter((r: LkhRecord) => Boolean(r.Tanggal));

        // Filter sesuai UserID guru terkait di sheet 09_LKH
        let filteredServer = allNormalizedServer.filter(belongsToCurrentGuru);

        // Jika server GAS sudah memfilter berdasarkan sesi token guru terkait namun UserID di localStorage
        // masih berupa fallback lokal (sehingga filteredServer kosong padahal semua baris server memiliki 1 UserID yang sama),
        // maka gunakan baris hasil filter sesi server tersebut dan sinkronkan UserID guru.
        if (filteredServer.length === 0 && allNormalizedServer.length > 0) {
          const distinctServerUserIds = new Set(
            allNormalizedServer
              .map((r: LkhRecord) => String(r.UserID || '').trim())
              .filter(Boolean)
          );
          if (distinctServerUserIds.size === 1) {
            filteredServer = allNormalizedServer;
          }
        }

        const mergedMap = new Map<string, LkhRecord>();
        filteredServer.forEach((rec: LkhRecord, i: number) => {
          const id =
            rec.LKHID ||
            rec.LkhID ||
            rec.lkhId ||
            `${rec.UserID}_${rec.Tanggal}_${rec.MataPelajaranID}_${rec.JamKe}_${rec.Kelas}_${i}`;
          mergedMap.set(id, rec);
        });

        const finalRecords = Array.from(mergedMap.values()).sort((a, b) => {
          const dateA = normalizeIsoDate(a.Tanggal || a.tanggal || '');
          const dateB = normalizeIsoDate(b.Tanggal || b.tanggal || '');
          if (dateA !== dateB) return dateB.localeCompare(dateA);
          return getRecordJamSortOrder(a) - getRecordJamSortOrder(b);
        });

        setHistoryRecords(finalRecords);
        try {
          localStorage.setItem(scopedStorageKey, JSON.stringify(finalRecords));
        } catch {}
      }
    } catch {
      if (localRecords.length === 0) {
        showToast('Gagal memuat data 09_LKH dari server.', 'error');
      }
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [scopedStorageKey]);

  useEffect(() => {
    if (activeTab === 'rekap') {
      loadHistory();
    }
  }, [activeTab]);

  // Daftar unik Mata Pelajaran untuk Formulir Jurnal (sesuai Master Ajar guru)
  const distinctMapelOptions = useMemo(() => {
    const mapelRefList =
      references?.MataPelajaran && references.MataPelajaran.length > 0
        ? references.MataPelajaran
        : DEFAULT_REFERENCES.MataPelajaran;
    const map = new Map<string, string>();

    pengajaranList.forEach(p => {
      const mId = String(p.mapelId || p.MataPelajaranID || '').trim();
      if (!mId) return;

      let resolvedName = String(p.mapelNama || '').trim();
      if (!resolvedName || resolvedName === mId) {
        const foundRef = mapelRefList.find(
          m => m.id === mId || m.code === mId || m.name === mId
        );
        resolvedName = foundRef ? foundRef.name || foundRef.code || mId : mId;
      }

      if (!map.has(mId)) {
        map.set(mId, resolvedName);
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [pengajaranList, references]);

  // Daftar unik Mata Pelajaran untuk Filter Rekap LKH (menggabungkan Master Ajar + MataPelajaranID yang ada di 09_LKH guru)
  const rekapMapelOptions = useMemo(() => {
    const mapelRefList =
      references?.MataPelajaran && references.MataPelajaran.length > 0
        ? references.MataPelajaran
        : DEFAULT_REFERENCES.MataPelajaran;
    const map = new Map<string, string>();

    distinctMapelOptions.forEach(item => {
      map.set(item.id, item.name);
    });

    historyRecords.forEach(rec => {
      const mId = String(rec.MataPelajaranID || rec.mapelId || '').trim();
      if (!mId || map.has(mId)) return;
      const foundRef = mapelRefList.find(
        m => m.id === mId || m.code === mId || m.name === mId
      );
      const resolvedName = foundRef
        ? foundRef.name || foundRef.code || mId
        : rec.mapelNama || mId;
      map.set(mId, resolvedName);
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [distinctMapelOptions, historyRecords, references]);

  // Daftar unik Kelas sesuai Master Ajar guru (mengikuti Mata Pelajaran yang dipilih pada Formulir Jurnal)
  const availableKelasOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];

    pengajaranList.forEach(p => {
      const mId = String(p.mapelId || p.MataPelajaranID || '').trim();
      const kls = String(p.kelas || p.Kelas || '').trim();
      if (!kls) return;
      if (mapelId && mId !== mapelId) return;
      if (!seen.has(kls)) {
        seen.add(kls);
        list.push(kls);
      }
    });

    return list;
  }, [pengajaranList, mapelId]);

  // Daftar Pilihan Uraian Aktivitas
  const uraianOptions = useMemo(() => {
    const fromRefs = (references?.UraianKerja || [])
      .map(u => String(u.name || u.code || '').trim())
      .filter(Boolean);
    const defaults = isNonKbm ? DEFAULT_SUGGESTIONS_URAIAN_NON_KBM : DEFAULT_SUGGESTIONS_URAIAN_KBM;
    return Array.from(new Set([...fromRefs, ...defaults]));
  }, [references, isNonKbm]);

  // Daftar Pilihan Hasil
  const hasilOptions = useMemo(() => {
    const fromRefs = (references?.Hasil || [])
      .map(h => String(h.name || h.code || '').trim())
      .filter(Boolean);
    return Array.from(new Set([...fromRefs, ...DEFAULT_SUGGESTIONS_HASIL]));
  }, [references]);

  // Himpunan Tanggal Unik yang Available pada Sheet 09_LKH sesuai UserID Guru Terkait
  const availableLkhDatesSet = useMemo(() => {
    const set = new Set<string>();
    historyRecords.forEach(rec => {
      if (!belongsToCurrentGuru(rec)) return;
      const iso = normalizeIsoDate(rec.Tanggal || rec.tanggal || '');
      if (iso) {
        set.add(iso);
      }
    });
    return set;
  }, [historyRecords, currentTeacherCandidateIds]);

  const sortedAvailableDates = useMemo(() => {
    return Array.from(availableLkhDatesSet).sort();
  }, [availableLkhDatesSet]);

  // Daftar bulan unik (YYYY-MM) yang memiliki data di 09_LKH milik guru terkait
  const availableYearMonths = useMemo(() => {
    const ymSet = new Set<string>();
    sortedAvailableDates.forEach(iso => {
      const ym = iso.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) {
        ymSet.add(ym);
      }
    });
    return Array.from(ymSet).sort();
  }, [sortedAvailableDates]);

  // Sinkronkan tampilan bulan kalender Rentang Tgl secara otomatis begitu data 09_LKH selesai dimuat
  useEffect(() => {
    if (sortedAvailableDates.length > 0) {
      const firstIso = rekapStartDate || sortedAvailableDates[0];
      const lastIso = rekapEndDate || sortedAvailableDates[sortedAvailableDates.length - 1];

      const m1 = firstIso.match(/^(\d{4})-(\d{2})/);
      if (m1) {
        setLeftCalView({ year: parseInt(m1[1], 10), month: parseInt(m1[2], 10) - 1 });
      }
      const m2 = lastIso.match(/^(\d{4})-(\d{2})/);
      if (m2) {
        setRightCalView({ year: parseInt(m2[1], 10), month: parseInt(m2[2], 10) - 1 });
      }
    }
  }, [sortedAvailableDates]);

  // Saat membuka modal Rentang Tgl, pastikan kalender langsung menampilkan bulan tempat data 09_LKH berada
  const handleOpenRekapRangeModal = () => {
    if (sortedAvailableDates.length > 0) {
      const firstIso = rekapStartDate || sortedAvailableDates[0];
      const lastIso = rekapEndDate || sortedAvailableDates[sortedAvailableDates.length - 1];

      const m1 = firstIso.match(/^(\d{4})-(\d{2})/);
      if (m1) {
        setLeftCalView({ year: parseInt(m1[1], 10), month: parseInt(m1[2], 10) - 1 });
      }
      const m2 = lastIso.match(/^(\d{4})-(\d{2})/);
      if (m2) {
        setRightCalView({ year: parseInt(m2[1], 10), month: parseInt(m2[2], 10) - 1 });
      }
    }
    setActiveModal('rekapRangeDate');
  };

  // Kalender Bulanan untuk Langkah 2 Wizard
  const wizardCalendarCells = useMemo(
    () => buildCalendarCells(calendarViewDate.year, calendarViewDate.month),
    [calendarViewDate]
  );

  // Kalender 2 Sisi untuk Filter Rentang Tanggal Rekap LKH
  const leftRangeCells = useMemo(
    () => buildCalendarCells(leftCalView.year, leftCalView.month),
    [leftCalView]
  );
  const rightRangeCells = useMemo(
    () => buildCalendarCells(rightCalView.year, rightCalView.month),
    [rightCalView]
  );

  const handleWizardPrevMonth = () => {
    setCalendarViewDate(prev =>
      prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 }
    );
  };

  const handleWizardNextMonth = () => {
    setCalendarViewDate(prev =>
      prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 }
    );
  };

  const handlePickToday = () => {
    const now = new Date();
    setTanggal(getTodayIso());
    setCalendarViewDate({ year: now.getFullYear(), month: now.getMonth() });
  };

  // Langkah 1: Pilih KBM / Non-KBM -> otomatis lanjut ke Langkah 2
  const handleSelectMode = (nonKbmMode: boolean) => {
    setIsNonKbm(nonKbmMode);
    setWizardStep(2);
  };

  // Pilih Mata Pelajaran dari Modal Mengambang
  const handleSelectMapel = (item: { id: string; name: string }) => {
    setMapelId(item.id);
    setMapelNama(item.name);

    const validKelasForMapel = pengajaranList
      .filter(p => String(p.mapelId || p.MataPelajaranID || '').trim() === item.id)
      .map(p => String(p.kelas || p.Kelas || '').trim())
      .filter(Boolean);

    if (kelas && !validKelasForMapel.includes(kelas)) {
      setKelas(validKelasForMapel.length === 1 ? validKelasForMapel[0] : '');
    } else if (!kelas && validKelasForMapel.length === 1) {
      setKelas(validKelasForMapel[0]);
    }

    setActiveModal(null);
  };

  // Pilih Kelas dari Modal Mengambang
  const handleSelectKelas = (selectedKls: string) => {
    setKelas(selectedKls);
    if (!mapelId) {
      const matchPengajaran = pengajaranList.find(
        p => String(p.kelas || p.Kelas || '').trim() === selectedKls
      );
      if (matchPengajaran) {
        const mId = String(matchPengajaran.mapelId || matchPengajaran.MataPelajaranID || '').trim();
        const foundMapel = distinctMapelOptions.find(m => m.id === mId);
        setMapelId(mId);
        setMapelNama(foundMapel?.name || matchPengajaran.mapelNama || mId);
      }
    }
    setActiveModal(null);
  };

  // Simpan Jurnal LKH (atau Simpan Perubahan saat Mode Edit) sesuai struktur 09_LKH
  const handleSubmitLkh = async () => {
    if (!tanggal) {
      showToast('Pilih tanggal pelaksanaan terlebih dahulu!', 'warning');
      setWizardStep(2);
      return;
    }
    if (!isNonKbm && !mapelId) {
      showToast('Pilih Mata Pelajaran terlebih dahulu!', 'warning');
      setWizardStep(3);
      return;
    }
    if (!isNonKbm && !kelas) {
      showToast('Pilih Kelas terlebih dahulu!', 'warning');
      setWizardStep(3);
      return;
    }
    if (!uraian.trim()) {
      showToast('Isi Uraian Aktivitas terlebih dahulu!', 'warning');
      return;
    }
    if (!isNonKbm && !hasil.trim()) {
      showToast('Isi Hasil pembelajaran terlebih dahulu!', 'warning');
      return;
    }

    setSubmitting(true);
    const targetId = editingRecordId || 'LKH-' + Date.now();
    const formattedJamKe =
      jamMulai !== '' && jamSelesai !== ''
        ? jamMulai === jamSelesai
          ? `${jamMulai}`
          : `${jamMulai}-${jamSelesai}`
        : jamMulai !== ''
        ? `${jamMulai}`
        : jamSelesai !== ''
        ? `${jamSelesai}`
        : '';

    const hasilFinal = isNonKbm ? (hasil.trim() || '1 Kegiatan') : hasil.trim();
    const userParafUrl =
      currentUser?.parafUrl || (currentUser as any)?.ParafGuruURL || '';
    const userParafFileId =
      (currentUser as any)?.ParafGuruFileID || (currentUser as any)?.parafFileId || '';
    const nowIso = new Date().toISOString();

    const rawRecordPayload: LkhRecord = {
      LKHID: targetId,
      LkhID: targetId,
      lkhId: targetId,
      UserID: guruUserId,
      userId: guruUserId,
      TahunAjaran: currentUser?.tahunAjaran || '2025/2026',
      Tanggal: tanggal,
      tanggal: tanggal,
      MataPelajaranID: isNonKbm ? '' : mapelId,
      mapelId: isNonKbm ? '' : mapelId,
      mapelNama: isNonKbm ? '' : mapelNama,
      JamKe: formattedJamKe,
      jamKe: formattedJamKe,
      JamMulai: jamMulai,
      jamMulai: jamMulai,
      JamSelesai: jamSelesai,
      jamSelesai: jamSelesai,
      Kelas: isNonKbm ? '' : kelas,
      kelas: isNonKbm ? '' : kelas,
      UraianKerja: uraian.trim(),
      uraianKerja: uraian.trim(),
      uraian: uraian.trim(),
      Hasil: hasilFinal,
      hasil: hasilFinal,
      HasilPembelajaran: hasilFinal,
      HariNonKBM: isNonKbm,
      hariNonKBM: isNonKbm,
      hariNonKbm: isNonKbm,
      IsNonKbm: isNonKbm,
      isNonKbm: isNonKbm,
      ParafGuruFileID: userParafFileId,
      ParafGuruURL: userParafUrl,
      ParafUrl: userParafUrl,
      parafUrl: userParafUrl,
      CreatedAt: nowIso,
      UpdatedAt: nowIso,
    };

    const recordPayload = normalizeSheet09LkhRecord(rawRecordPayload);

    let updatedList: LkhRecord[];
    if (editingRecordId) {
      updatedList = historyRecords.map(r =>
        (r.LKHID || r.LkhID || r.lkhId) === editingRecordId ? recordPayload : r
      );
    } else {
      updatedList = [recordPayload, ...historyRecords];
    }

    setHistoryRecords(updatedList);
    try {
      localStorage.setItem(scopedStorageKey, JSON.stringify(updatedList));
    } catch {}

    const wasEditing = Boolean(editingRecordId);

    try {
      const activeToken = localStorage.getItem('ajar_token') || token;
      const res = await callGasApi<any>('saveLkhRecord', [
        activeToken,
        recordPayload,
        guruIdentifier,
      ]);
      if (res && res.success) {
        showToast(
          wasEditing ? 'Perubahan LKH berhasil disimpan!' : 'Jurnal LKH berhasil disimpan!',
          'success'
        );
      } else {
        showToast('Tersimpan di perangkat.', 'info');
      }
    } catch {
      showToast('Jurnal disimpan secara lokal.', 'info');
    } finally {
      setSubmitting(false);
      setEditingRecordId(null);
      setUraian('');
      setHasil('');
      setJamMulai('');
      setJamSelesai('');
      setWizardStep(1);
      if (wasEditing) {
        setActiveTab('rekap');
        setIsRekapPreviewed(true);
      }
      loadHistory();
    }
  };

  // Mengalihkan baris dari Rekap LKH ke Mode Edit pada Wizard Formulir
  const handleEditRecordFromRekap = (rec: LkhRecord) => {
    const norm = normalizeSheet09LkhRecord(rec);
    const recId = norm.LKHID || norm.LkhID || norm.lkhId || '';
    setEditingRecordId(recId || null);

    const isNonKbmRec = parseHariNonKbm(
      norm.HariNonKBM ?? norm.IsNonKbm ?? norm.isNonKbm
    );
    setIsNonKbm(isNonKbmRec);

    const recDate = normalizeIsoDate(norm.Tanggal || norm.tanggal || getTodayIso());
    setTanggal(recDate || getTodayIso());

    const recMapelId = String(norm.MataPelajaranID || norm.mapelId || '').trim();
    const recKelas = String(norm.Kelas || norm.kelas || '').trim();
    if (!isNonKbmRec) {
      const foundMapel = rekapMapelOptions.find(
        m =>
          m.id === recMapelId ||
          m.name.toLowerCase() === String(norm.mapelNama || '').toLowerCase()
      );
      setMapelId(foundMapel ? foundMapel.id : recMapelId);
      setMapelNama(foundMapel ? foundMapel.name : norm.mapelNama || recMapelId);
      setKelas(recKelas);
    }

    const { jamMulai: jm, jamSelesai: js } = parseJamKeField(norm);
    setJamMulai(jm);
    setJamSelesai(js);
    setUraian(norm.UraianKerja || norm.uraian || '');
    setHasil(norm.Hasil || norm.HasilPembelajaran || norm.hasil || '');

    setWizardStep(3);
    setActiveTab('form');
    showToast('Mode Edit aktif: silakan perbarui data jurnal.', 'info');
  };

  // Hapus Catatan LKH (saat ikon hapus diklik setelah tekan lama)
  const handleDeleteRecord = async (lkhId: string) => {
    if (deletingId || isDeletingBatch) return;
    setDeletingId(lkhId);
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      next.delete(lkhId);
      return next;
    });

    const prevRecords = [...historyRecords];
    const nextRecords = prevRecords.filter(
      r => (r.LKHID || r.LkhID || r.lkhId) !== lkhId
    );
    setHistoryRecords(nextRecords);
    try {
      localStorage.setItem(scopedStorageKey, JSON.stringify(nextRecords));
    } catch {}

    try {
      const activeToken = localStorage.getItem('ajar_token') || token;
      const res = await callGasApi<any>('deleteLkhRecord', [
        activeToken,
        lkhId,
        guruIdentifier,
      ]);
      if (res && res.success) {
        showToast('Catatan jurnal berhasil dihapus.', 'success');
      } else {
        showToast('Catatan dihapus dari daftar.', 'info');
      }
    } catch {
      showToast('Catatan dihapus secara lokal.', 'info');
    } finally {
      setDeletingId(null);
    }
  };

  // Handler Pilih Baris Mode Edit (Tekan 2x / Double-Tap untuk memilih baris hapus)
  const handleToggleRowSelection = (rowId: string) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const handleRowClick = (rowId: string) => {
    if (!isRekapEditMode) return;

    // Jika mode multi-pilih sudah aktif (sudah ada minimal 1 baris dipilih),
    // pengguna cukup menekan 1x (tidak perlu tekan 2x lagi)
    if (selectedRowIds.size > 0) {
      lastTapRef.current = null;
      handleToggleRowSelection(rowId);
      return;
    }

    // Pada awal (belum ada baris yang dipilih), tekan 2x untuk memulai pemilihan
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.rowId === rowId && now - last.time < 450) {
      lastTapRef.current = null;
      handleToggleRowSelection(rowId);
    } else {
      lastTapRef.current = { rowId, time: now };
    }
  };

  // Hapus Sekaligus Banyak Catatan LKH yang Terpilih
  const handleDeleteBulkRecords = async () => {
    if (isDeletingBatch || selectedRowIds.size === 0) return;
    const idsToDelete = new Set(selectedRowIds);
    setIsDeletingBatch(true);
    setSelectedRowIds(new Set());

    const prevRecords = [...historyRecords];
    const nextRecords = prevRecords.filter(
      r => !idsToDelete.has(r.LKHID || r.LkhID || r.lkhId)
    );
    setHistoryRecords(nextRecords);
    try {
      localStorage.setItem(scopedStorageKey, JSON.stringify(nextRecords));
    } catch {}

    try {
      const activeToken = localStorage.getItem('ajar_token') || token;
      await Promise.allSettled(
        Array.from(idsToDelete).map(id =>
          callGasApi<any>('deleteLkhRecord', [activeToken, id, guruIdentifier])
        )
      );
      showToast(`${idsToDelete.size} catatan jurnal berhasil dihapus.`, 'success');
    } catch {
      showToast('Catatan jurnal dihapus secara lokal.', 'info');
    } finally {
      setIsDeletingBatch(false);
    }
  };

  // Status Filter Rekap LKH
  const isRangeDateSelected = Boolean(rekapStartDate && rekapEndDate);
  const isMapelFilterSelected = Boolean(rekapMapelFilter);
  const isRekapFilterReady = isRangeDateSelected && isMapelFilterSelected;

  // Label Filter Mata Pelajaran pada Rekap LKH
  const rekapMapelFilterLabel = useMemo(() => {
    if (!rekapMapelFilter) return 'Pilih Mata Pelajaran';
    if (rekapMapelFilter === 'ALL') return 'Semua';
    const found = rekapMapelOptions.find(m => m.id === rekapMapelFilter);
    return found ? found.name : rekapMapelFilter;
  }, [rekapMapelFilter, rekapMapelOptions]);

  // Ekspor Dokumen LKH PDF Resmi langsung dari Panel Rekap LKH
  const handleExportPdfFromRekap = () => {
    if (previewFilteredRecords.length === 0) {
      showToast('Tidak ada data jurnal LKH untuk dicetak.', 'warning');
      return;
    }
    const startNorm = rekapStartDate <= rekapEndDate ? rekapStartDate : rekapEndDate;
    const endNorm = rekapStartDate <= rekapEndDate ? rekapEndDate : rekapStartDate;

    const primaryMapel = resolvePrimaryMapelName({
      pengajaranList,
      references,
      currentUser,
      lkhRecords: previewFilteredRecords,
    });

    const filename = buildOfficialLkhFilename({
      currentUser,
      startDate: startNorm,
      endDate: endNorm,
      format: 'pdf',
    });

    try {
      exportLkhOfficialPdf({
        filename,
        startDate: startNorm,
        endDate: endNorm,
        currentUser,
        primaryMapelName: primaryMapel,
        records: previewFilteredRecords,
      });
      showToast(`Dokumen ${filename} berhasil diunduh.`, 'success');
    } catch {
      showToast('Gagal membuat dokumen PDF LKH.', 'error');
    }
  };

  // Hasil Filter Data 09_LKH untuk Tabel Preview Rekap LKH (Diurutkan berdasarkan Tanggal & JamKe)
  const previewFilteredRecords = useMemo(() => {
    if (!isRekapFilterReady) return [];
    const startNorm = rekapStartDate <= rekapEndDate ? rekapStartDate : rekapEndDate;
    const endNorm = rekapStartDate <= rekapEndDate ? rekapEndDate : rekapStartDate;

    const filtered = historyRecords.filter(rec => {
      if (!belongsToCurrentGuru(rec)) return false;

      const recDate = normalizeIsoDate(rec.Tanggal || rec.tanggal || '');
      if (!recDate || recDate < startNorm || recDate > endNorm) {
        return false;
      }

      if (rekapMapelFilter !== 'ALL') {
        const isNonKbmRec = parseHariNonKbm(
          rec.HariNonKBM ?? rec.IsNonKbm ?? rec.isNonKbm
        );
        if (isNonKbmRec) return false;

        const selectedMapelObj = rekapMapelOptions.find(m => m.id === rekapMapelFilter);
        const recMapelId = String(rec.MataPelajaranID || rec.mapelId || '').trim();
        const recMapelNama = String(rec.mapelNama || '').trim().toLowerCase();

        const mapelMatch =
          recMapelId === rekapMapelFilter ||
          (selectedMapelObj && recMapelNama === selectedMapelObj.name.toLowerCase());

        if (!mapelMatch) return false;
      }

      return true;
    });

    // Urutkan berdasarkan Tanggal (naik) lalu Jam Mulai (naik) (Non-KBM tanpa jam ke di paling atas)
    return [...filtered].sort((a, b) => {
      const dA = normalizeIsoDate(a.Tanggal || a.tanggal || '');
      const dB = normalizeIsoDate(b.Tanggal || b.tanggal || '');
      if (dA !== dB) return dA.localeCompare(dB);
      return getRecordJamSortOrder(a) - getRecordJamSortOrder(b);
    });
  }, [
    historyRecords,
    isRekapFilterReady,
    rekapStartDate,
    rekapEndDate,
    rekapMapelFilter,
    rekapMapelOptions,
    currentTeacherCandidateIds,
  ]);

  // Perhitungan rowSpan untuk Merge Tanggal yang Sama pada Tabel Preview
  const dateRowSpanInfo = useMemo(() => {
    const info: Array<{ rowSpan: number; isFirstOfDate: boolean }> = [];
    let i = 0;
    while (i < previewFilteredRecords.length) {
      const currDate = normalizeIsoDate(
        previewFilteredRecords[i].Tanggal || previewFilteredRecords[i].tanggal || ''
      );
      let span = 1;
      while (
        i + span < previewFilteredRecords.length &&
        normalizeIsoDate(
          previewFilteredRecords[i + span].Tanggal ||
            previewFilteredRecords[i + span].tanggal ||
            ''
        ) === currDate
      ) {
        span++;
      }
      info.push({ rowSpan: span, isFirstOfDate: true });
      for (let k = 1; k < span; k++) {
        info.push({ rowSpan: 0, isFirstOfDate: false });
      }
      i += span;
    }
    return info;
  }, [previewFilteredRecords]);

  const hasParaf = Boolean(
    (currentUser?.parafUrl && String(currentUser.parafUrl).trim()) ||
      ((currentUser as any)?.ParafGuruURL && String((currentUser as any).ParafGuruURL).trim()) ||
      ((currentUser as any)?.ParafGuruFileID && String((currentUser as any).ParafGuruFileID).trim())
  );
  const todayIso = getTodayIso();

  const isMapelSelected = Boolean(mapelId);
  const isKelasSelected = Boolean(kelas);
  const isJamSelected = jamMulai !== '' || jamSelesai !== '';
  const isUraianSelected = Boolean(uraian.trim());
  const isHasilSelected = Boolean(hasil.trim());

  const selectedMapelNameLabel = useMemo(() => {
    if (!mapelId) return '';
    const found = distinctMapelOptions.find(m => m.id === mapelId);
    return found ? found.name : mapelNama || mapelId;
  }, [mapelId, mapelNama, distinctMapelOptions]);

  const jamButtonSubtitle = useMemo(() => {
    if (jamMulai !== '' && jamSelesai !== '') {
      return jamMulai === jamSelesai ? `${jamMulai}` : `${jamMulai}-${jamSelesai}`;
    }
    if (jamMulai !== '') {
      return `${jamMulai}`;
    }
    if (jamSelesai !== '') {
      return `${jamSelesai}`;
    }
    return '';
  }, [jamMulai, jamSelesai]);

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col gap-2.5 select-none overflow-hidden relative">
      {/* ========================================================================= */}
      {/* 1. SEGMENTED TAB SWITCHER (Formulir Jurnal vs Rekap LKH)                  */}
      {/* ========================================================================= */}
      <div className="neu-pressed bg-[#E8EEF6] p-1.5 rounded-2xl shrink-0 flex items-center border border-white/70">
        <button
          type="button"
          onClick={() => setActiveTab('form')}
          className={`flex-1 min-h-[40px] py-1.5 px-3 rounded-xl text-xs transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'form'
              ? 'neu-flat bg-[#EEF2F6] text-blue-700 font-medium border border-white/90'
              : 'text-slate-500 font-normal hover:text-slate-800'
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>{editingRecordId ? 'Edit Jurnal' : 'Formulir Jurnal'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rekap')}
          className={`flex-1 min-h-[40px] py-1.5 px-3 rounded-xl text-xs transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'rekap'
              ? 'neu-flat bg-[#EEF2F6] text-blue-700 font-medium border border-white/90'
              : 'text-slate-500 font-normal hover:text-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Rekap LKH</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 2. TAB 1: MODE WIZARD INTERAKTIF (GARIS TITIK RINGKAS, TANPA JUDUL)       */}
      {/* ========================================================================= */}
      {activeTab === 'form' ? (
        <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
          {/* PENANDA LANGKAH GARIS-TITIK SAJA DENGAN TOMBOL BERSIHKAN DI SAMPINGNYA */}
          <div className="shrink-0 py-1.5 px-4 flex items-center justify-center">
            <div className="flex items-center gap-1.5">
              {([1, 2, 3, 4] as const).map((stepNum, idx) => {
                const isActive = wizardStep === stepNum;
                const isPassed = wizardStep > stepNum;
                return (
                  <React.Fragment key={stepNum}>
                    <button
                      type="button"
                      onClick={() => setWizardStep(stepNum)}
                      aria-label={`Langkah ${stepNum}`}
                      className={`h-2.5 rounded-full transition-all duration-200 cursor-pointer ${
                        isActive
                          ? 'w-7 bg-blue-600 shadow-[0_0_6px_rgba(37,99,235,0.45)]'
                          : isPassed
                          ? 'w-2.5 bg-emerald-500'
                          : 'w-2.5 neu-pressed bg-[#D5DFEC]'
                      }`}
                    />
                    {idx < 3 && (
                      <div
                        className={`w-6 sm:w-8 h-[2px] rounded-full transition-colors duration-200 ${
                          wizardStep > stepNum ? 'bg-emerald-500/70' : 'bg-[#D5DFEC]'
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Tombol Bersihkan di Samping Garis Titik Penanda Step */}
            <button
              type="button"
              onClick={handleResetForm}
              title="Bersihkan isian formulir saat ini"
              aria-label="Bersihkan isian formulir"
              className="ml-3 sm:ml-4 w-6 h-6 sm:w-7 sm:h-7 rounded-full neu-flat active:neu-pressed text-slate-400 hover:text-rose-600 border border-white/80 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-90 group"
            >
              <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform duration-300 group-hover:-rotate-90 group-active:-rotate-180" />
            </button>
          </div>

          {/* KARTU UTAMA WIZARD */}
          <div className="flex-1 min-h-0 overflow-y-auto touch-scroll overscroll-contain pr-0.5 pb-2 flex flex-col">
            {/* ------------------------------------------------------------------- */}
            {/* LANGKAH 1: PILIHAN KBM DAN NON-KBM (Kiri & Kanan, Otomatis Lanjut)  */}
            {/* ------------------------------------------------------------------- */}
            {wizardStep === 1 && (
              <div className="flex-1 neu-raised-card bg-[#EEF2F6] rounded-3xl p-5 sm:p-6 border border-white/90 flex flex-col justify-center animate-in fade-in duration-150">
                <div className="grid grid-cols-2 gap-4 sm:gap-5 my-auto">
                  {/* KIRI: KBM */}
                  <button
                    type="button"
                    onClick={() => handleSelectMode(false)}
                    className={`min-h-[180px] sm:min-h-[210px] p-5 rounded-3xl flex flex-col items-center justify-center gap-3.5 text-center transition-all duration-150 cursor-pointer active:scale-97 relative ${
                      !isNonKbm
                        ? 'neu-flat bg-[#EEF2F6] border-2 border-blue-400/80 text-blue-700'
                        : 'neu-flat bg-[#EEF2F6] border border-white/90 text-slate-700 hover:text-blue-700'
                    }`}
                  >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl neu-pressed bg-[#E8EEF6] flex items-center justify-center text-blue-600 border border-white/80">
                      <BookOpen className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2]" />
                    </div>
                    <span className="block text-sm sm:text-base font-semibold text-[#0D162B]">
                      KBM
                    </span>
                  </button>

                  {/* KANAN: Non-KBM */}
                  <button
                    type="button"
                    onClick={() => handleSelectMode(true)}
                    className={`min-h-[180px] sm:min-h-[210px] p-5 rounded-3xl flex flex-col items-center justify-center gap-3.5 text-center transition-all duration-150 cursor-pointer active:scale-97 relative ${
                      isNonKbm
                        ? 'neu-flat bg-[#EEF2F6] border-2 border-blue-400/80 text-blue-700'
                        : 'neu-flat bg-[#EEF2F6] border border-white/90 text-slate-700 hover:text-blue-700'
                    }`}
                  >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl neu-pressed bg-[#E8EEF6] flex items-center justify-center text-blue-600 border border-white/80">
                      <Briefcase className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2]" />
                    </div>
                    <span className="block text-sm sm:text-base font-semibold text-[#0D162B]">
                      Non-KBM
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------------- */}
            {/* LANGKAH 2: KALENDER LANGSUNG + TOMBOL HARI INI & TOMBOL LANJUT       */}
            {/* ------------------------------------------------------------------- */}
            {wizardStep === 2 && (
              <div className="flex-1 neu-raised-card bg-[#EEF2F6] rounded-3xl p-4 sm:p-5 border border-white/90 flex flex-col justify-between gap-4 animate-in fade-in duration-150">
                <div className="neu-pressed bg-[#E8EEF6] rounded-2xl p-3 sm:p-4 border border-white/80 space-y-3 my-auto">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleWizardPrevMonth}
                      className="min-h-[40px] min-w-[40px] rounded-xl neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-700 hover:text-blue-700 active:scale-95 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <span className="text-xs sm:text-sm font-semibold text-[#0D162B] tracking-tight">
                      {MONTH_NAMES_ID[calendarViewDate.month]} {calendarViewDate.year}
                    </span>

                    <button
                      type="button"
                      onClick={handleWizardNextMonth}
                      className="min-h-[40px] min-w-[40px] rounded-xl neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-700 hover:text-blue-700 active:scale-95 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center">
                    {DAY_HEADERS_ID.map(h => (
                      <div key={h} className="text-[11px] font-medium text-slate-500 py-1">
                        {h}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {wizardCalendarCells.map((cell, idx) => {
                      if (!cell.day) {
                        return <div key={`empty-${idx}`} className="h-9 sm:h-10" />;
                      }
                      const isSelected = tanggal === cell.isoDate;
                      const isToday = todayIso === cell.isoDate;
                      return (
                        <button
                          key={cell.isoDate}
                          type="button"
                          onClick={() => setTanggal(cell.isoDate)}
                          className={`h-9 sm:h-10 rounded-xl font-mono tabular-nums text-xs transition-all flex items-center justify-center cursor-pointer ${
                            isSelected
                              ? 'neu-btn-primary text-white font-semibold shadow-sm'
                              : isToday
                              ? 'neu-flat bg-[#EEF2F6] text-blue-700 font-semibold border border-blue-400/80'
                              : 'neu-flat bg-[#EEF2F6] text-slate-700 font-normal hover:text-blue-700 border border-white/70 active:scale-95'
                          }`}
                        >
                          {cell.day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handlePickToday}
                    className="min-h-[44px] py-2.5 px-4 rounded-2xl neu-btn bg-[#EEF2F6] text-xs font-medium text-blue-700 hover:text-blue-800 active:scale-97 transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/90"
                  >
                    <CalendarDays className="w-4 h-4" />
                    <span>Hari Ini</span>
                  </button>

                  <button
                    type="button"
                    disabled={!tanggal}
                    onClick={() => setWizardStep(3)}
                    className="min-h-[44px] py-2.5 px-4 rounded-2xl neu-btn-primary text-white text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-97 disabled:opacity-50 cursor-pointer"
                  >
                    <span>Lanjut</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------------- */}
            {/* LANGKAH 3: MATA PELAJARAN (TERPISAH), KELAS (TERPISAH) & JAM KE     */}
            {/* ------------------------------------------------------------------- */}
            {wizardStep === 3 && (
              <div className="flex-1 neu-raised-card bg-[#EEF2F6] rounded-3xl p-5 sm:p-6 border border-white/90 flex flex-col justify-between gap-4 animate-in fade-in duration-150">
                <div className="space-y-3.5 my-auto">
                  {!isNonKbm && (
                    <>
                      {/* TOMBOL 1: MATA PELAJARAN (Terpisah) */}
                      <button
                        type="button"
                        onClick={() => setActiveModal('mapel')}
                        className={`w-full min-h-[56px] px-4 py-3 rounded-2xl neu-btn bg-[#EEF2F6] flex items-center justify-between gap-3 text-left cursor-pointer transition-all ${
                          isMapelSelected
                            ? 'border-2 border-blue-400/80'
                            : 'border border-white/90'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl neu-pressed bg-[#E8EEF6] flex items-center justify-center text-blue-600 shrink-0">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="block text-xs font-semibold text-[#0D162B]">
                              Mata Pelajaran
                            </span>
                            {isMapelSelected && (
                              <span className="block text-xs text-blue-700 font-medium truncate mt-0.5">
                                {selectedMapelNameLabel}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isMapelSelected && (
                            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </span>
                          )}
                        </div>
                      </button>

                      {/* TOMBOL 2: KELAS (Terpisah) */}
                      <button
                        type="button"
                        onClick={() => setActiveModal('kelas')}
                        className={`w-full min-h-[56px] px-4 py-3 rounded-2xl neu-btn bg-[#EEF2F6] flex items-center justify-between gap-3 text-left cursor-pointer transition-all ${
                          isKelasSelected
                            ? 'border-2 border-blue-400/80'
                            : 'border border-white/90'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl neu-pressed bg-[#E8EEF6] flex items-center justify-center text-blue-600 shrink-0">
                            <Layers className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="block text-xs font-semibold text-[#0D162B]">
                              Kelas
                            </span>
                            {isKelasSelected && (
                              <span className="block text-xs text-blue-700 font-medium truncate mt-0.5">
                                {kelas}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isKelasSelected && (
                            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </span>
                          )}
                        </div>
                      </button>
                    </>
                  )}

                  {/* TOMBOL 3: JAM KE (OPSIONAL) */}
                  <button
                    type="button"
                    onClick={() => setActiveModal('jamKe')}
                    className={`w-full min-h-[56px] px-4 py-3 rounded-2xl neu-btn bg-[#EEF2F6] flex items-center justify-between gap-3 text-left cursor-pointer transition-all ${
                      isJamSelected
                        ? 'border-2 border-blue-400/80'
                        : 'border border-white/90'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl neu-pressed bg-[#E8EEF6] flex items-center justify-center text-blue-600 shrink-0">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-semibold text-[#0D162B]">
                          Jam Ke (Opsional)
                        </span>
                        {jamButtonSubtitle && (
                          <span className="block text-xs font-mono tabular-nums text-blue-700 font-medium truncate mt-0.5">
                            {jamButtonSubtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isJamSelected && (
                        <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                  </button>
                </div>

                {/* Tombol Lanjut */}
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={!isNonKbm && (!isMapelSelected || !isKelasSelected)}
                    onClick={() => setWizardStep(4)}
                    className="w-full min-h-[44px] py-2.5 px-4 rounded-2xl neu-btn-primary text-white text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    <span>Lanjut</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------------- */}
            {/* LANGKAH 4: TOMBOL MENGAMBANG URAIAN & HASIL + PARAF SINGKAT + SIMPAN*/}
            {/* ------------------------------------------------------------------- */}
            {wizardStep === 4 && (
              <div className="flex-1 neu-raised-card bg-[#EEF2F6] rounded-3xl p-5 sm:p-6 border border-white/90 flex flex-col justify-between gap-4 animate-in fade-in duration-150">
                <div className="space-y-4 my-auto">
                  {/* TOMBOL 1: URAIAN AKTIVITAS */}
                  <button
                    type="button"
                    onClick={() => setActiveModal('uraian')}
                    className={`w-full min-h-[58px] px-4 py-3 rounded-2xl neu-btn bg-[#EEF2F6] flex items-center justify-between gap-3 text-left cursor-pointer transition-all ${
                      isUraianSelected
                        ? 'border-2 border-blue-400/80'
                        : 'border border-white/90'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-[#0D162B]">
                        Uraian Aktivitas
                      </span>
                      {isUraianSelected && (
                        <span className="block text-xs text-blue-700 font-normal truncate mt-0.5">
                          {uraian}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isUraianSelected && (
                        <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                  </button>

                  {/* TOMBOL 2: HASIL (Khusus KBM) */}
                  {!isNonKbm && (
                    <button
                      type="button"
                      onClick={() => setActiveModal('hasil')}
                      className={`w-full min-h-[58px] px-4 py-3 rounded-2xl neu-btn bg-[#EEF2F6] flex items-center justify-between gap-3 text-left cursor-pointer transition-all ${
                        isHasilSelected
                          ? 'border-2 border-blue-400/80'
                          : 'border border-white/90'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-[#0D162B]">
                          Hasil
                        </span>
                        {isHasilSelected && (
                          <span className="block text-xs text-blue-700 font-normal truncate mt-0.5">
                            {hasil}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isHasilSelected && (
                          <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </span>
                        )}
                      </div>
                    </button>
                  )}

                  {/* TULISAN SINGKAT STATUS PARAF */}
                  <div className="neu-pressed bg-[#E8EEF6] rounded-2xl px-4 py-3 border border-white/80 flex items-center justify-center">
                    <span
                      className={`text-xs font-medium flex items-center gap-1.5 ${
                        hasParaf ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{hasParaf ? 'Sudah ada paraf' : 'Belum ada paraf'}</span>
                    </span>
                  </div>
                </div>

                {/* TOMBOL SIMPAN */}
                <div className="pt-2 flex items-center gap-2">
                  {editingRecordId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRecordId(null);
                        setUraian('');
                        setHasil('');
                        setWizardStep(1);
                        setActiveTab('rekap');
                      }}
                      className="min-h-[44px] py-2.5 px-4 rounded-2xl neu-btn bg-[#EEF2F6] text-xs font-medium text-slate-600 cursor-pointer"
                    >
                      Batal
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSubmitLkh}
                    disabled={submitting}
                    className="flex-1 min-h-[44px] py-2.5 px-4 rounded-2xl neu-btn-primary text-white text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 text-white" />
                        <span>Simpan</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 3. TAB 2: PANEL "REKAP LKH" (Sesuai Data Sheet 09_LKH UserID Guru)        */
        /* ========================================================================= */
        <div className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
          {/* BAR FILTER: RENTANG TGL (Kiri) & MATA PELAJARAN (Kanan) */}
          <div className="grid grid-cols-2 gap-2.5 shrink-0">
            {/* Tombol Filter Rentang Tgl (Klik -> Muncul 2 Sisi Kalender Fullscreen Tanpa Scroll Vertikal) */}
            <button
              type="button"
              onClick={handleOpenRekapRangeModal}
              className={`min-h-[48px] px-3.5 py-2 rounded-2xl neu-btn bg-[#EEF2F6] flex items-center justify-between gap-2 text-left cursor-pointer transition-all ${
                isRangeDateSelected
                  ? 'border-2 border-blue-400/80'
                  : 'border border-white/90'
              }`}
            >
              <div className="min-w-0">
                <span className="block text-[11px] font-semibold text-[#0D162B]">
                  Rentang Tgl
                </span>
                <span
                  className={`block text-[10.5px] font-mono tabular-nums truncate ${
                    isRangeDateSelected ? 'text-blue-700 font-medium' : 'text-slate-400'
                  }`}
                >
                  {isRangeDateSelected
                    ? `${formatShortDateId(rekapStartDate)} - ${formatShortDateId(rekapEndDate)}`
                    : loadingHistory
                    ? 'Memuat 09_LKH...'
                    : 'Pilih Rentang'}
                </span>
              </div>
              {isRangeDateSelected && (
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
              )}
            </button>

            {/* Tombol Filter Mata Pelajaran (Semua + List Mata Pelajaran Saja) */}
            <button
              type="button"
              onClick={() => setActiveModal('rekapMapelFilter')}
              className={`min-h-[48px] px-3.5 py-2 rounded-2xl neu-btn bg-[#EEF2F6] flex items-center justify-between gap-2 text-left cursor-pointer transition-all ${
                isMapelFilterSelected
                  ? 'border-2 border-blue-400/80'
                  : 'border border-white/90'
              }`}
            >
              <div className="min-w-0">
                <span className="block text-[11px] font-semibold text-[#0D162B]">
                  Mata Pelajaran
                </span>
                <span
                  className={`block text-[11px] truncate ${
                    isMapelFilterSelected ? 'text-blue-700 font-medium' : 'text-slate-400'
                  }`}
                >
                  {rekapMapelFilterLabel}
                </span>
              </div>
              {isMapelFilterSelected && (
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
              )}
            </button>
          </div>

          {/* KONTEN REKAP LKH: SEBELUM PREVIEW VS SESUDAH PREVIEW */}
          {!isRekapPreviewed ? (
            <div className="flex-1 neu-raised-card bg-[#EEF2F6] rounded-3xl p-6 border border-white/90 flex flex-col items-center justify-center text-center gap-5">
              <div className="w-14 h-14 rounded-2xl neu-pressed bg-[#E8EEF6] text-blue-600 flex items-center justify-center border border-white/80">
                <Filter className="w-6 h-6 stroke-[2]" />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#0D162B]">
                  Tentukan filter
                </p>
                <p className="text-xs text-slate-500 font-normal max-w-xs">
                  Pilih Rentang Tgl dan Mata Pelajaran di atas untuk menampilkan tabel Rekap LKH.
                </p>
              </div>

              <button
                type="button"
                disabled={!isRekapFilterReady}
                onClick={() => setIsRekapPreviewed(true)}
                className="w-full max-w-xs min-h-[44px] py-2.5 px-5 rounded-2xl neu-btn-primary text-white text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-97 disabled:opacity-45 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Preview</span>
              </button>
            </div>
          ) : (
            /* TABEL REKAP LKH: 6 Kolom (No, Tgl, Jam Ke, Kelas, Uraian, Hasil) Tanpa Paraf & Tanpa Scroll Horizontal */
            <div className="flex-1 min-h-0 neu-raised-card bg-[#EEF2F6] rounded-3xl p-2.5 sm:p-3.5 border border-white/90 flex flex-col gap-2 overflow-hidden">
              {/* Toolbar Atas Tabel: Info & Tombol Edit */}
              <div className="shrink-0 flex items-center justify-between gap-2 px-1">
                <span className="text-[10.5px] text-slate-500 font-normal truncate">
                  {isRekapEditMode
                    ? selectedRowIds.size > 0
                      ? `${selectedRowIds.size} baris dipilih • Ketuk 1x baris untuk pilih/batal`
                      : `${previewFilteredRecords.length} baris • Tekan 2x baris untuk pilih hapus`
                    : `${previewFilteredRecords.length} baris jurnal`}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isRekapEditMode && selectedRowIds.size > 1 && (
                    <button
                      type="button"
                      onClick={handleDeleteBulkRecords}
                      disabled={isDeletingBatch}
                      title={`Hapus ${selectedRowIds.size} baris yang dipilih`}
                      className="min-h-[32px] px-2.5 py-1 rounded-xl text-[11px] font-medium neu-btn bg-rose-600 text-white hover:bg-rose-700 flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {isDeletingBatch ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Hapus ({selectedRowIds.size})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsRekapEditMode(prev => {
                        const next = !prev;
                        if (!next) {
                          setSelectedRowIds(new Set());
                          lastTapRef.current = null;
                        }
                        return next;
                      });
                    }}
                    title={isRekapEditMode ? 'Kembali ke mode biasa' : 'Mode Edit'}
                    className={`min-h-[32px] rounded-xl text-[11px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0 ${
                      isRekapEditMode
                        ? 'w-8 px-0 neu-btn bg-[#EEF2F6] text-rose-600 hover:text-rose-700 border border-white/90'
                        : 'px-2.5 py-1 neu-btn bg-[#EEF2F6] text-slate-700 hover:text-blue-700 border border-white/90'
                    }`}
                  >
                    {isRekapEditMode ? (
                      <X className="w-3.5 h-3.5 stroke-[2.5]" />
                    ) : (
                      <>
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Kontainer Tabel: Hanya Isi yang Bisa Discroll Vertikal, Tanpa Scroll Horizontal */}
              <div className="flex-1 min-h-0 neu-pressed bg-[#E8EEF6] rounded-2xl border border-white/80 flex flex-col overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden touch-scroll overscroll-contain">
                  <table className="w-full table-fixed border-collapse text-left">
                    <thead className="sticky top-0 z-20 bg-[#DCE5F2] border-b border-slate-300 text-[9.5px] sm:text-[10.5px] font-semibold text-[#0D162B] shadow-2xs">
                      <tr>
                        <th className="w-[7%] py-2 px-1 text-center border-r border-slate-300/70">
                          No
                        </th>
                        <th className="w-[18%] py-2 px-1 text-center border-r border-slate-300/70">
                          Tgl
                        </th>
                        <th className="w-[11%] py-2 px-1 text-center border-r border-slate-300/70">
                          Jam Ke
                        </th>
                        <th className="w-[12%] py-2 px-1 text-center border-r border-slate-300/70">
                          Kelas
                        </th>
                        <th className="w-[32%] py-2 px-1.5 border-r border-slate-300/70">
                          Uraian
                        </th>
                        <th className="w-[20%] py-2 px-1.5">
                          Hasil
                        </th>
                      </tr>
                    </thead>

                    <tbody className="text-[9.5px] sm:text-[10.5px] leading-tight text-[#0D162B]">
                      {previewFilteredRecords.length > 0 ? (
                        previewFilteredRecords.map((rec, idx) => {
                          const recId = rec.LKHID || rec.LkhID || rec.lkhId || `lkh-${idx}`;
                          const isNonKbmRec = parseHariNonKbm(
                            rec.HariNonKBM ?? rec.IsNonKbm ?? rec.isNonKbm
                          );
                          const tgl = String(rec.Tanggal || rec.tanggal || '-');

                          const { jamKeStr } = parseJamKeField(rec);
                          const hasJam = Boolean(jamKeStr);

                          const kelasVal = String(rec.Kelas || rec.kelas || '-').trim();
                          const rawUraianVal = String(
                            rec.UraianKerja || rec.uraianKerja || rec.uraian || '-'
                          ).trim();
                          // Pastikan tidak ada tulisan [Non-KBM]
                          const uraianVal = rawUraianVal.replace(/^\[Non-KBM\]\s*/i, '').trim() || '-';
                          const hasilVal = String(
                            rec.Hasil || rec.HasilPembelajaran || rec.hasil || '-'
                          ).trim();

                          const spanInfo = dateRowSpanInfo[idx] || {
                            rowSpan: 1,
                            isFirstOfDate: true,
                          };
                          const isRowSelected = isRekapEditMode && selectedRowIds.has(recId);

                          const renderEditModeActions = () => {
                            if (!isRekapEditMode) return null;
                            if (isRowSelected) {
                              return (
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    handleDeleteRecord(recId);
                                  }}
                                  disabled={deletingId === recId || isDeletingBatch}
                                  title="Hapus Baris"
                                  className="shrink-0 w-6 h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                                >
                                  {deletingId === recId ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              );
                            }
                            return (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  handleEditRecordFromRekap(rec);
                                }}
                                title="Edit Baris"
                                className="shrink-0 w-6 h-6 rounded-lg neu-btn bg-[#EEF2F6] text-blue-600 hover:text-blue-700 flex items-center justify-center cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            );
                          };

                          return (
                            <tr
                              key={recId}
                              onClick={() => handleRowClick(recId)}
                              title={
                                isRekapEditMode
                                  ? selectedRowIds.size > 0
                                    ? isRowSelected
                                      ? 'Ketuk 1x untuk batal pilih'
                                      : 'Ketuk 1x untuk memilih'
                                    : 'Tekan 2x untuk mulai memilih hapus'
                                  : undefined
                              }
                              className={`border-b border-slate-300/70 transition-colors ${
                                isRowSelected
                                  ? 'bg-rose-50/95 ring-1 ring-inset ring-rose-300/60'
                                  : isRekapEditMode
                                  ? 'hover:bg-blue-50/70 cursor-pointer select-none touch-manipulation'
                                  : 'hover:bg-white/40'
                              }`}
                            >
                              {/* 1. Kolom No */}
                              <td className="py-2 px-1 text-center align-top font-mono tabular-nums border-r border-slate-300/60 break-words">
                                {idx + 1}
                              </td>

                              {/* 2. Kolom Tgl (Diawali Nama Hari, misal Senin, 1 Sep 2026 & Di-merge rata atas sejajar Nomor) */}
                              {spanInfo.isFirstOfDate && (
                                <td
                                  rowSpan={spanInfo.rowSpan}
                                  className="py-2 px-1 text-center align-top font-mono tabular-nums border-r border-slate-300/60 break-words whitespace-normal bg-[#E4ECF7]/60"
                                >
                                  {formatPreviewDateWithDayId(tgl)}
                                </td>
                              )}

                              {/* 3..6. Kolom Jam Ke, Kelas, Uraian, Hasil (Merge sesuai aturan Non-KBM vs KBM, tanpa tulisan [Non-KBM]) */}
                              {isNonKbmRec ? (
                                !hasJam ? (
                                  /* Non-KBM & Jam TIDAK dipilih -> Merge dari Jam Ke s/d Hasil (colSpan = 4) */
                                  <td
                                    colSpan={4}
                                    className="py-2 px-1.5 align-top break-words whitespace-normal"
                                  >
                                    <div className="flex items-start justify-between gap-1.5">
                                      <span className="flex-1 min-w-0">{uraianVal}</span>
                                      {renderEditModeActions()}
                                    </div>
                                  </td>
                                ) : (
                                  /* Non-KBM & Jam DIPILIH -> Jam Ke tampil, lalu Merge dari Kelas s/d Hasil (colSpan = 3) */
                                  <>
                                    <td className="py-2 px-1 text-center align-top font-mono tabular-nums border-r border-slate-300/60 break-words whitespace-normal">
                                      {jamKeStr}
                                    </td>
                                    <td
                                      colSpan={3}
                                      className="py-2 px-1.5 align-top break-words whitespace-normal"
                                    >
                                      <div className="flex items-start justify-between gap-1.5">
                                        <span className="flex-1 min-w-0">{uraianVal}</span>
                                        {renderEditModeActions()}
                                      </div>
                                    </td>
                                  </>
                                )
                              ) : (
                                /* Baris KBM Normal */
                                <>
                                  <td className="py-2 px-1 text-center align-top font-mono tabular-nums border-r border-slate-300/60 break-words whitespace-normal">
                                    {jamKeStr || '-'}
                                  </td>
                                  <td className="py-2 px-1 text-center align-top font-medium border-r border-slate-300/60 break-words whitespace-normal">
                                    {kelasVal || '-'}
                                  </td>
                                  <td className="py-2 px-1.5 align-top border-r border-slate-300/60 break-words whitespace-normal">
                                    {uraianVal}
                                  </td>
                                  <td className="py-2 px-1.5 align-top break-words whitespace-normal">
                                    <div className="flex items-start justify-between gap-1.5">
                                      <span className="flex-1 min-w-0">{hasilVal}</span>
                                      {renderEditModeActions()}
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-8 px-3 text-center text-[11px] text-slate-500"
                          >
                            Tidak ada catatan jurnal LKH pada filter rentang tanggal dan mata pelajaran ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. FLOATING MODALS (MENGAMBANG SERAGAM MODERN NEUMORPHISM / SOFT UI)      */}
      {/* ========================================================================= */}

      {/* MODAL MENGAMBANG 1A: PILIH MATA PELAJARAN (FORMULIR JURNAL) */}
      {activeModal === 'mapel' && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm neu-raised-card bg-[#EEF2F6] rounded-3xl p-4 sm:p-5 border border-white/90 shadow-2xl space-y-3.5 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#0D162B]">
                Mata Pelajaran
              </span>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-xl neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {distinctMapelOptions.length === 0 ? (
              <div className="p-4 rounded-2xl neu-pressed bg-[#E8EEF6] text-xs text-amber-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Master Ajar belum diatur.</span>
                </div>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null);
                      onNavigate('master-ajar');
                    }}
                    className="px-3 py-1.5 rounded-xl neu-btn bg-[#EEF2F6] text-[11px] font-medium text-blue-700 cursor-pointer"
                  >
                    Master Ajar
                  </button>
                )}
              </div>
            ) : (
              <div className="neu-pressed bg-[#E8EEF6] p-2.5 rounded-2xl border border-white/80 max-h-64 overflow-y-auto touch-scroll space-y-2">
                {distinctMapelOptions.map(item => {
                  const isSelected = mapelId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectMapel(item)}
                      className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-between gap-2 transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'neu-pressed bg-[#E2ECF9] text-blue-700 font-semibold border border-blue-400/80'
                          : 'neu-flat bg-[#EEF2F6] text-[#0D162B] font-medium hover:text-blue-700 border border-white/90'
                      }`}
                    >
                      <span className="truncate">{item.name}</span>
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-emerald-500 text-white'
                            : 'neu-pressed bg-[#E8EEF6] text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL MENGAMBANG 1B: PILIH KELAS (FORMULIR JURNAL) */}
      {activeModal === 'kelas' && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm neu-raised-card bg-[#EEF2F6] rounded-3xl p-4 sm:p-5 border border-white/90 shadow-2xl space-y-3.5 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#0D162B]">
                Kelas
              </span>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-xl neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {availableKelasOptions.length === 0 ? (
              <div className="p-4 rounded-2xl neu-pressed bg-[#E8EEF6] text-xs text-slate-600 text-center">
                Pilih Mata Pelajaran terlebih dahulu atau atur kelas di Master Ajar.
              </div>
            ) : (
              <div className="neu-pressed bg-[#E8EEF6] p-2.5 rounded-2xl border border-white/80 max-h-64 overflow-y-auto touch-scroll grid grid-cols-2 gap-2">
                {availableKelasOptions.map(kls => {
                  const isSelected = kelas === kls;
                  return (
                    <button
                      key={kls}
                      type="button"
                      onClick={() => handleSelectKelas(kls)}
                      className={`min-h-[44px] px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'neu-pressed bg-[#E2ECF9] text-blue-700 font-semibold border border-blue-400/80'
                          : 'neu-flat bg-[#EEF2F6] text-[#0D162B] font-medium hover:text-blue-700 border border-white/90'
                      }`}
                    >
                      <span className="truncate">{kls}</span>
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-emerald-500 text-white'
                            : 'neu-pressed bg-[#E8EEF6] text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL MENGAMBANG 2: JAM KE (OPSIONAL) - LIST 2 SISI 1 s.d. 10 */}
      {activeModal === 'jamKe' && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm neu-raised-card bg-[#EEF2F6] rounded-3xl p-4 sm:p-5 border border-white/90 shadow-2xl space-y-3.5 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#0D162B]">
                Jam Ke (Opsional)
              </span>
              <div className="flex items-center gap-1.5">
                {isJamSelected && (
                  <button
                    type="button"
                    onClick={() => {
                      setJamMulai('');
                      setJamSelesai('');
                    }}
                    className="px-2.5 py-1 rounded-xl neu-btn bg-[#EEF2F6] text-[11px] font-medium text-rose-600 cursor-pointer"
                  >
                    Kosongkan
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-8 h-8 rounded-xl neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="neu-pressed bg-[#E8EEF6] rounded-2xl p-3 border border-white/80 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-slate-600 text-center">
                  Dari Jam
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(num => {
                    const isSelected = jamMulai === num;
                    return (
                      <button
                        key={`start-${num}`}
                        type="button"
                        onClick={() => setJamMulai(prev => (prev === num ? '' : num))}
                        className={`min-h-[36px] py-1 rounded-xl font-mono tabular-nums text-xs transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          isSelected
                            ? 'neu-pressed bg-[#E2ECF9] text-blue-700 font-semibold border border-blue-400/80'
                            : 'neu-flat bg-[#EEF2F6] text-slate-700 font-normal hover:text-blue-700 border border-white/80'
                        }`}
                      >
                        <span>{num}</span>
                        {isSelected && <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-slate-600 text-center">
                  Sampai Jam
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(num => {
                    const isSelected = jamSelesai === num;
                    return (
                      <button
                        key={`end-${num}`}
                        type="button"
                        onClick={() => setJamSelesai(prev => (prev === num ? '' : num))}
                        className={`min-h-[36px] py-1 rounded-xl font-mono tabular-nums text-xs transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          isSelected
                            ? 'neu-pressed bg-[#E2ECF9] text-blue-700 font-semibold border border-blue-400/80'
                            : 'neu-flat bg-[#EEF2F6] text-slate-700 font-normal hover:text-blue-700 border border-white/80'
                        }`}
                      >
                        <span>{num}</span>
                        {isSelected && <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full min-h-[42px] py-2 rounded-2xl neu-btn-primary text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Selesai</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL MENGAMBANG 3: URAIAN AKTIVITAS */}
      {activeModal === 'uraian' && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md neu-raised-card bg-[#EEF2F6] rounded-3xl p-4 sm:p-5 border border-white/90 shadow-2xl space-y-3.5 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#0D162B]">
                Uraian Aktivitas
              </span>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-xl neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="neu-pressed bg-[#E8EEF6] p-2.5 rounded-2xl border border-white/80 max-h-48 overflow-y-auto touch-scroll space-y-1.5">
              {uraianOptions.map((item, idx) => {
                const isSelected = uraian.trim() === item;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setUraian(item)}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'neu-pressed bg-[#E2ECF9] text-blue-700 font-medium border border-blue-400/80'
                        : 'neu-flat bg-[#EEF2F6] text-slate-700 font-normal hover:text-blue-700 border border-white/80'
                    }`}
                  >
                    <span className="leading-snug">{item}</span>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <textarea
              rows={3}
              value={uraian}
              onChange={e => setUraian(e.target.value)}
              placeholder="Ketik manual uraian aktivitas di sini..."
              className="w-full rounded-2xl neu-pressed bg-[#E8EEF6] border border-white/80 p-3 text-xs text-[#0D162B] placeholder:text-slate-400 font-normal outline-none focus:border-blue-500/80 transition-all resize-none leading-relaxed"
            />

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full min-h-[42px] py-2 rounded-2xl neu-btn-primary text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Selesai</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL MENGAMBANG 4: HASIL */}
      {activeModal === 'hasil' && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md neu-raised-card bg-[#EEF2F6] rounded-3xl p-4 sm:p-5 border border-white/90 shadow-2xl space-y-3.5 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#0D162B]">
                Hasil
              </span>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-xl neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="neu-pressed bg-[#E8EEF6] p-2.5 rounded-2xl border border-white/80 max-h-48 overflow-y-auto touch-scroll space-y-1.5">
              {hasilOptions.map((item, idx) => {
                const isSelected = hasil.trim() === item;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setHasil(item)}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'neu-pressed bg-[#E2ECF9] text-blue-700 font-medium border border-blue-400/80'
                        : 'neu-flat bg-[#EEF2F6] text-slate-700 font-normal hover:text-blue-700 border border-white/80'
                    }`}
                  >
                    <span className="leading-snug">{item}</span>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <textarea
              rows={3}
              value={hasil}
              onChange={e => setHasil(e.target.value)}
              placeholder="Ketik manual hasil pembelajaran di sini..."
              className="w-full rounded-2xl neu-pressed bg-[#E8EEF6] border border-white/80 p-3 text-xs text-[#0D162B] placeholder:text-slate-400 font-normal outline-none focus:border-blue-500/80 transition-all resize-none leading-relaxed"
            />

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full min-h-[42px] py-2 rounded-2xl neu-btn-primary text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Selesai</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL MENGAMBANG 5: FILTER RENTANG TGL (FULLSCREEN TANPA SCROLL VERTIKAL, HANYA AVAILABLE SESUAI 09_LKH USERID GURU) */}
      {activeModal === 'rekapRangeDate' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#EEF2F6] flex flex-col justify-between p-2.5 sm:p-4 overflow-hidden select-none animate-in fade-in duration-150"
        >
          {/* Header Fullscreen */}
          <div className="shrink-0 flex items-center justify-between gap-2 px-1 pb-1">
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-[#0D162B] block truncate">
                Pilih Rentang Tanggal (Data 09_LKH)
              </span>
              <span className="text-[10px] text-slate-500 block truncate">
                {sortedAvailableDates.length > 0
                  ? `${sortedAvailableDates.length} tanggal tersedia (${formatShortDateId(sortedAvailableDates[0])} s.d. ${formatShortDateId(sortedAvailableDates[sortedAvailableDates.length - 1])})`
                  : loadingHistory
                  ? 'Sedang memuat tanggal dari sheet 09_LKH...'
                  : 'Belum ada tanggal tercatat untuk akun Anda di sheet 09_LKH'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {availableYearMonths.length > 1 && (
                <div className="hidden sm:flex items-center gap-1">
                  {availableYearMonths.slice(-3).map(ym => {
                    const [yStr, mStr] = ym.split('-');
                    const yNum = parseInt(yStr, 10);
                    const mNum = parseInt(mStr, 10) - 1;
                    return (
                      <button
                        key={ym}
                        type="button"
                        onClick={() => {
                          setLeftCalView({ year: yNum, month: mNum });
                          setRightCalView({ year: yNum, month: mNum });
                        }}
                        className="px-2 py-1 rounded-lg neu-btn bg-[#EEF2F6] text-[10px] font-medium text-blue-700 cursor-pointer"
                      >
                        {SHORT_MONTH_NAMES_ID[mNum]} {yNum}
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-xl neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2 Sisi Kalender Termuat Penuh Tanpa Scroll Vertikal */}
          <div className="flex-1 min-h-0 grid grid-rows-2 sm:grid-rows-1 sm:grid-cols-2 gap-2 sm:gap-3 overflow-hidden py-1">
            {/* SISI 1: DARI TANGGAL */}
            <div className="neu-pressed bg-[#E8EEF6] rounded-2xl p-2 sm:p-3 border border-white/80 flex flex-col justify-between overflow-hidden">
              <div className="shrink-0 flex items-center justify-between px-1">
                <span className="text-[10.5px] font-semibold text-blue-700">
                  Dari Tgl: {rekapStartDate ? formatShortDateId(rekapStartDate) : '-'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setLeftCalView(prev =>
                        prev.month === 0
                          ? { year: prev.year - 1, month: 11 }
                          : { year: prev.year, month: prev.month - 1 }
                      )
                    }
                    className="w-6 h-6 rounded-lg neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-700 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-semibold text-[#0D162B] min-w-[74px] text-center">
                    {SHORT_MONTH_NAMES_ID[leftCalView.month]} {leftCalView.year}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setLeftCalView(prev =>
                        prev.month === 11
                          ? { year: prev.year + 1, month: 0 }
                          : { year: prev.year, month: prev.month + 1 }
                      )
                    }
                    className="w-6 h-6 rounded-lg neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-700 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="shrink-0 grid grid-cols-7 gap-0.5 text-center pt-1">
                {DAY_HEADERS_ID.map(h => (
                  <div key={`l-${h}`} className="text-[9.5px] font-medium text-slate-500">
                    {h}
                  </div>
                ))}
              </div>

              <div className="flex-1 min-h-0 grid grid-cols-7 auto-rows-fr gap-1 pt-0.5">
                {leftRangeCells.map((cell, idx) => {
                  if (!cell.day) return <div key={`le-${idx}`} />;
                  const isAvailable = availableLkhDatesSet.has(cell.isoDate);
                  const isSelected = rekapStartDate === cell.isoDate;
                  return (
                    <button
                      key={`l-${cell.isoDate}`}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => {
                        if (!isAvailable) return;
                        setRekapStartDate(cell.isoDate);
                        if (!rekapEndDate) setRekapEndDate(cell.isoDate);
                        setIsRekapPreviewed(false);
                      }}
                      className={`rounded-lg font-mono tabular-nums text-[10.5px] flex items-center justify-center transition-all ${
                        !isAvailable
                          ? 'opacity-30 text-slate-400 cursor-not-allowed'
                          : isSelected
                          ? 'neu-btn-primary text-white font-semibold cursor-pointer shadow-xs'
                          : 'neu-flat bg-[#EEF2F6] text-blue-700 font-semibold border border-blue-300/80 hover:border-blue-500 cursor-pointer'
                      }`}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SISI 2: SAMPAI TANGGAL */}
            <div className="neu-pressed bg-[#E8EEF6] rounded-2xl p-2 sm:p-3 border border-white/80 flex flex-col justify-between overflow-hidden">
              <div className="shrink-0 flex items-center justify-between px-1">
                <span className="text-[10.5px] font-semibold text-blue-700">
                  Sampai Tgl: {rekapEndDate ? formatShortDateId(rekapEndDate) : '-'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setRightCalView(prev =>
                        prev.month === 0
                          ? { year: prev.year - 1, month: 11 }
                          : { year: prev.year, month: prev.month - 1 }
                      )
                    }
                    className="w-6 h-6 rounded-lg neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-700 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-semibold text-[#0D162B] min-w-[74px] text-center">
                    {SHORT_MONTH_NAMES_ID[rightCalView.month]} {rightCalView.year}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setRightCalView(prev =>
                        prev.month === 11
                          ? { year: prev.year + 1, month: 0 }
                          : { year: prev.year, month: prev.month + 1 }
                      )
                    }
                    className="w-6 h-6 rounded-lg neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-700 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="shrink-0 grid grid-cols-7 gap-0.5 text-center pt-1">
                {DAY_HEADERS_ID.map(h => (
                  <div key={`r-${h}`} className="text-[9.5px] font-medium text-slate-500">
                    {h}
                  </div>
                ))}
              </div>

              <div className="flex-1 min-h-0 grid grid-cols-7 auto-rows-fr gap-1 pt-0.5">
                {rightRangeCells.map((cell, idx) => {
                  if (!cell.day) return <div key={`re-${idx}`} />;
                  const isAvailable = availableLkhDatesSet.has(cell.isoDate);
                  const isSelected = rekapEndDate === cell.isoDate;
                  return (
                    <button
                      key={`r-${cell.isoDate}`}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => {
                        if (!isAvailable) return;
                        setRekapEndDate(cell.isoDate);
                        if (!rekapStartDate) setRekapStartDate(cell.isoDate);
                        setIsRekapPreviewed(false);
                      }}
                      className={`rounded-lg font-mono tabular-nums text-[10.5px] flex items-center justify-center transition-all ${
                        !isAvailable
                          ? 'opacity-30 text-slate-400 cursor-not-allowed'
                          : isSelected
                          ? 'neu-btn-primary text-white font-semibold cursor-pointer shadow-xs'
                          : 'neu-flat bg-[#EEF2F6] text-blue-700 font-semibold border border-blue-300/80 hover:border-blue-500 cursor-pointer'
                      }`}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tombol Selesai di Bawah Fullscreen */}
          <div className="shrink-0 pt-1.5">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full min-h-[42px] py-2 rounded-2xl neu-btn-primary text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Selesai</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL MENGAMBANG 6: FILTER MATA PELAJARAN (SEMUA + LIST MATA PELAJARAN SAJA) */}
      {activeModal === 'rekapMapelFilter' && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm neu-raised-card bg-[#EEF2F6] rounded-3xl p-4 sm:p-5 border border-white/90 shadow-2xl space-y-3.5 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#0D162B]">
                Mata Pelajaran
              </span>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-xl neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="neu-pressed bg-[#E8EEF6] p-2.5 rounded-2xl border border-white/80 max-h-64 overflow-y-auto touch-scroll space-y-2">
              {/* Pilihan Semua */}
              <button
                type="button"
                onClick={() => {
                  setRekapMapelFilter('ALL');
                  setIsRekapPreviewed(false);
                  setActiveModal(null);
                }}
                className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-all cursor-pointer text-left ${
                  rekapMapelFilter === 'ALL'
                    ? 'neu-pressed bg-[#E2ECF9] text-blue-700 font-semibold border border-blue-400/80'
                    : 'neu-flat bg-[#EEF2F6] text-[#0D162B] font-medium hover:text-blue-700 border border-white/90'
                }`}
              >
                <span>Semua</span>
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    rekapMapelFilter === 'ALL'
                      ? 'bg-emerald-500 text-white'
                      : 'neu-pressed bg-[#E8EEF6] text-transparent'
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
              </button>

              {/* List Mata Pelajaran Saja sesuai Master Ajar & Data 09_LKH Guru */}
              {rekapMapelOptions.map(item => {
                const isSelected = rekapMapelFilter === item.id;
                return (
                  <button
                    key={`rekap-mapel-${item.id}`}
                    type="button"
                    onClick={() => {
                      setRekapMapelFilter(item.id);
                      setIsRekapPreviewed(false);
                      setActiveModal(null);
                    }}
                    className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'neu-pressed bg-[#E2ECF9] text-blue-700 font-semibold border border-blue-400/80'
                        : 'neu-flat bg-[#EEF2F6] text-[#0D162B] font-medium hover:text-blue-700 border border-white/90'
                    }`}
                  >
                    <span className="truncate">{item.name}</span>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-emerald-500 text-white'
                          : 'neu-pressed bg-[#E8EEF6] text-transparent'
                      }`}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
