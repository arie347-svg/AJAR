import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  ClipboardCheck,
  Award,
  BookOpen,
  Layers,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PengajaranItem,
  SiswaItem,
  LkhRecord,
  User,
  ReferencesMap,
  MasterAjarData,
} from '../types';
import { callGasApi, DEFAULT_REFERENCES } from '../services/gasApi';
import {
  resolvePrimaryMapelName,
  buildOfficialLkhFilename,
  exportLkhOfficialPdf,
  exportLkhOfficialWord,
  exportLkhOfficialExcel,
} from '../utils/lkhExportDocument';

interface LaporanProps {
  token: string;
  currentUser: User | null;
  pengajaranList: PengajaranItem[];
  masterAjarData?: MasterAjarData | null;
  references?: ReferencesMap;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

type ReportCategory = 'presensi' | 'nilai' | 'lkh';
type FileFormat = 'pdf' | 'word' | 'excel';
type ActiveSubModal = null | 'rangeDate' | 'filterSelector' | 'monthPicker';

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

const MONTH_BOXES = [
  { idx: 0, label: 'JAN' },
  { idx: 1, label: 'FEB' },
  { idx: 2, label: 'MAR' },
  { idx: 3, label: 'APR' },
  { idx: 4, label: 'MEI' },
  { idx: 5, label: 'JUN' },
  { idx: 6, label: 'JUL' },
  { idx: 7, label: 'AGU' },
  { idx: 8, label: 'SEP' },
  { idx: 9, label: 'OKT' },
  { idx: 10, label: 'NOV' },
  { idx: 11, label: 'DES' },
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

function normalizeIsoDate(dateVal: unknown): string {
  if (!dateVal) return '';
  const clean = String(dateVal).trim();
  if (!clean) return '';

  const plainIsoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (plainIsoMatch) {
    return `${plainIsoMatch[1]}-${plainIsoMatch[2].padStart(2, '0')}-${plainIsoMatch[3].padStart(2, '0')}`;
  }

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

  const prefixIsoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (prefixIsoMatch) {
    return `${prefixIsoMatch[1]}-${prefixIsoMatch[2].padStart(2, '0')}-${prefixIsoMatch[3].padStart(2, '0')}`;
  }

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

function formatDateWithDayId(dateStr: string): string {
  if (!dateStr) return '-';
  const norm = normalizeIsoDate(dateStr);
  const isoMatch = norm.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const monthIdx = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    if (monthIdx >= 0 && monthIdx < 12) {
      const dObj = new Date(year, monthIdx, day);
      const dayName = DAY_NAMES_ID[dObj.getDay()] || '';
      return `${dayName}, ${day} ${SHORT_MONTH_NAMES_ID[monthIdx]} ${year}`;
    }
  }
  return dateStr;
}

function parseHariNonKbm(rawVal: unknown): boolean {
  if (typeof rawVal === 'boolean') return rawVal;
  if (typeof rawVal === 'number') return rawVal === 1;
  if (typeof rawVal === 'string') {
    const upper = rawVal.trim().toUpperCase();
    if (upper === 'TRUE' || upper === '1' || upper === 'YA' || upper === 'NON-KBM') {
      return true;
    }
  }
  return false;
}

function formatCompactJamKe(raw: any): string {
  const rawJamKe = String(raw?.JamKe ?? raw?.jamKe ?? '').trim();
  const rawMulai = raw?.JamMulai ?? raw?.jamMulai ?? '';
  const rawSelesai = raw?.JamSelesai ?? raw?.jamSelesai ?? '';
  if (rawJamKe) {
    const nums = rawJamKe.match(/\d+/g);
    if (nums && nums.length >= 2) {
      const m = parseInt(nums[0], 10);
      const s = parseInt(nums[1], 10);
      return m === s ? `${m}` : `${m}-${s}`;
    }
    if (nums && nums.length === 1) {
      return `${parseInt(nums[0], 10)}`;
    }
    return rawJamKe;
  }
  if (rawMulai !== '' && rawSelesai !== '') {
    return Number(rawMulai) === Number(rawSelesai)
      ? `${rawMulai}`
      : `${rawMulai}-${rawSelesai}`;
  }
  if (rawMulai !== '') return `${rawMulai}`;
  if (rawSelesai !== '') return `${rawSelesai}`;
  return '-';
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

export const Laporan: React.FC<LaporanProps> = ({
  token,
  currentUser,
  pengajaranList,
  masterAjarData,
  references,
  showToast,
}) => {
  // Modal Mengambang Utama: null | 'presensi' | 'nilai' | 'lkh'
  const [activeCategoryModal, setActiveCategoryModal] = useState<ReportCategory | null>(null);

  // Sub-Modal Mengambang: null | 'rangeDate' | 'filterSelector'
  const [activeSubModal, setActiveSubModal] = useState<ActiveSubModal>(null);

  // State Filter Rentang Tanggal (Disamakan dengan tampilan Rentang Tanggal pada Rekap LKH)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // State Filter Kelas/Mata Pelajaran (Presensi & Nilai) atau Mata Pelajaran (LKH)
  const [selectedFilterId, setSelectedFilterId] = useState<string>('');

  // State Format File Terpilih (Menampilkan Filename + Tombol Download + Tombol "x")
  const [selectedFormat, setSelectedFormat] = useState<FileFormat | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);

  // State Kalender 2 Sisi Fullscreen
  const [leftCalView, setLeftCalView] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [rightCalView, setRightCalView] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Data LKH dari Sheet 09_LKH sesuai UserID guru
  const [lkhRecords, setLkhRecords] = useState<LkhRecord[]>([]);
  const [loadingLkh, setLoadingLkh] = useState<boolean>(false);

  // Identitas UserID guru terkait
  const guruUserId = useMemo(() => {
    return String(
      currentUser?.userId ||
        (currentUser as any)?.UserID ||
        currentUser?.nip ||
        currentUser?.username ||
        ''
    ).trim();
  }, [currentUser]);

  const currentTeacherCandidateIds = useMemo(() => {
    if (!currentUser) return [] as string[];
    const rawList = [
      currentUser.userId,
      (currentUser as any).UserID,
      currentUser.nip,
      currentUser.username,
    ];
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

  const belongsToCurrentGuru = (rec: LkhRecord): boolean => {
    if (!currentUser) return true;
    const recUserId = String(rec.UserID || rec.userId || '').trim().toLowerCase();
    if (!recUserId) return true;
    if (currentTeacherCandidateIds.length === 0) return true;
    return currentTeacherCandidateIds.includes(recUserId);
  };

  // Muat data LKH dari localStorage & GAS 09_LKH agar tanggal di kalender & export akurat
  const loadLkhData = async () => {
    setLoadingLkh(true);
    try {
      const scopedKey = guruUserId ? `ajar_lkh_records_${guruUserId}` : 'ajar_lkh_records';
      const rawLocal = localStorage.getItem(scopedKey);
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLkhRecords(parsed.filter(belongsToCurrentGuru));
        }
      }

      const activeToken = localStorage.getItem('ajar_token') || token;
      const res = await callGasApi<any>('getLkhData', [activeToken, guruUserId]);
      const rawArray = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.records)
        ? res.records
        : null;

      if (res && res.success && rawArray) {
        let filtered = rawArray.filter(belongsToCurrentGuru);
        if (filtered.length === 0 && rawArray.length > 0) {
          filtered = rawArray;
        }
        setLkhRecords(filtered);
      }
    } catch {
      // Gunakan fallback lokal bila koneksi lambat
    } finally {
      setLoadingLkh(false);
    }
  };

  useEffect(() => {
    loadLkhData();
  }, [guruUserId]);

  // Resolusi Nama Mata Pelajaran dari Master Ajar + References
  const mapelRefList = useMemo(() => {
    return references?.MataPelajaran && references.MataPelajaran.length > 0
      ? references.MataPelajaran
      : DEFAULT_REFERENCES.MataPelajaran;
  }, [references]);

  const resolveMapelName = (mId: string, fallbackName?: string): string => {
    const cleanId = String(mId || '').trim();
    const cleanFallback = String(fallbackName || '').trim();
    if (cleanFallback && cleanFallback !== cleanId) return cleanFallback;
    const found = mapelRefList.find(
      m => m.id === cleanId || m.code === cleanId || m.name === cleanId
    );
    return found ? found.name || found.code || cleanId : cleanId || '-';
  };

  // Resolusi Mata Pelajaran Utama Guru untuk Sampul & Header Identitas LKH
  const primaryMapelName = useMemo(() => {
    return resolvePrimaryMapelName({
      masterAjarData,
      pengajaranList,
      references,
      currentUser,
      lkhRecords,
    });
  }, [masterAjarData, pengajaranList, references, currentUser, lkhRecords]);

  // Daftar Opsi Filter untuk PRESENSI & NILAI: "Semua" + Daftar Kelas/Mata Pelajaran
  const kelasMapelOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ id: string; label: string; kelas: string; mapelId: string; mapelNama: string }> = [];

    pengajaranList.forEach(p => {
      const kls = String(p.kelas || p.Kelas || '').trim();
      const mId = String(p.mapelId || p.MataPelajaranID || '').trim();
      if (!kls && !mId) return;
      const mNama = resolveMapelName(mId, p.mapelNama);
      const key = `${kls}|${mId}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          id: key,
          label: `${kls} / ${mNama}`,
          kelas: kls,
          mapelId: mId,
          mapelNama: mNama,
        });
      }
    });

    return list;
  }, [pengajaranList, mapelRefList]);

  // Daftar Opsi Filter untuk LKH: "Semua" + Daftar Mata Pelajaran saja
  const mapelOnlyOptions = useMemo(() => {
    const map = new Map<string, string>();

    pengajaranList.forEach(p => {
      const mId = String(p.mapelId || p.MataPelajaranID || '').trim();
      if (!mId) return;
      map.set(mId, resolveMapelName(mId, p.mapelNama));
    });

    lkhRecords.forEach(rec => {
      const mId = String(rec.MataPelajaranID || rec.mapelId || '').trim();
      if (!mId || map.has(mId)) return;
      map.set(mId, resolveMapelName(mId, rec.mapelNama));
    });

    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [pengajaranList, lkhRecords, mapelRefList]);

  // Tahun terpilih untuk modal Bulan LKH
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  const handleSelectMonth = (monthIndex: number) => {
    const year = selectedYear;
    const startStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const endStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    setStartDate(startStr);
    setEndDate(endStr);
    setActiveSubModal(null);
  };

  const lkhPeriodDisplayLabel = useMemo(() => {
    if (!startDate || !endDate) return 'Pilih Bulan';
    const startNorm = startDate <= endDate ? startDate : endDate;
    const endNorm = startDate <= endDate ? endDate : startDate;

    const mStart = startNorm.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const mEnd = endNorm.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (mStart && mEnd) {
      const yearStart = parseInt(mStart[1], 10);
      const monthStart = parseInt(mStart[2], 10) - 1;
      const dayStart = parseInt(mStart[3], 10);

      const yearEnd = parseInt(mEnd[1], 10);
      const monthEnd = parseInt(mEnd[2], 10) - 1;
      const dayEnd = parseInt(mEnd[3], 10);

      const lastDayOfStartMonth = new Date(yearStart, monthStart + 1, 0).getDate();

      if (
        yearStart === yearEnd &&
        monthStart === monthEnd &&
        dayStart === 1 &&
        dayEnd === lastDayOfStartMonth
      ) {
        return `${MONTH_NAMES_ID[monthStart]} ${yearStart}`;
      }
    }

    return `${formatShortDateId(startNorm)} - ${formatShortDateId(endNorm)}`;
  }, [startDate, endDate]);

  // Himpunan Tanggal Tersedia dari 09_LKH milik Guru
  const availableLkhDatesSet = useMemo(() => {
    const set = new Set<string>();
    lkhRecords.forEach(rec => {
      if (!belongsToCurrentGuru(rec)) return;
      const iso = normalizeIsoDate(rec.Tanggal || rec.tanggal || '');
      if (iso) set.add(iso);
    });
    return set;
  }, [lkhRecords, currentTeacherCandidateIds]);

  const sortedAvailableDates = useMemo(() => {
    return Array.from(availableLkhDatesSet).sort();
  }, [availableLkhDatesSet]);

  const availableYearMonths = useMemo(() => {
    const ymSet = new Set<string>();
    sortedAvailableDates.forEach(iso => {
      const ym = iso.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) ymSet.add(ym);
    });
    return Array.from(ymSet).sort();
  }, [sortedAvailableDates]);

  // Saat membuka kartu kategori Laporan (Presensi, Nilai, LKH)
  const handleOpenCategoryModal = (category: ReportCategory) => {
    setActiveCategoryModal(category);
    setActiveSubModal(null);
    setSelectedFormat(null);
    setSelectedFilterId(category === 'lkh' ? 'ALL' : '');
    if (category === 'lkh') setSelectedYear(new Date().getFullYear());
    setStartDate('');
    setEndDate('');

    if (sortedAvailableDates.length > 0) {
      const firstIso = sortedAvailableDates[0];
      const lastIso = sortedAvailableDates[sortedAvailableDates.length - 1];
      const m1 = firstIso.match(/^(\d{4})-(\d{2})/);
      if (m1) {
        setLeftCalView({ year: parseInt(m1[1], 10), month: parseInt(m1[2], 10) - 1 });
      }
      const m2 = lastIso.match(/^(\d{4})-(\d{2})/);
      if (m2) {
        setRightCalView({ year: parseInt(m2[1], 10), month: parseInt(m2[2], 10) - 1 });
      }
    }
  };

  const handleOpenRangeDateModal = () => {
    if (sortedAvailableDates.length > 0) {
      const firstIso = startDate || sortedAvailableDates[0];
      const lastIso = endDate || sortedAvailableDates[sortedAvailableDates.length - 1];
      const m1 = firstIso.match(/^(\d{4})-(\d{2})/);
      if (m1) {
        setLeftCalView({ year: parseInt(m1[1], 10), month: parseInt(m1[2], 10) - 1 });
      }
      const m2 = lastIso.match(/^(\d{4})-(\d{2})/);
      if (m2) {
        setRightCalView({ year: parseInt(m2[1], 10), month: parseInt(m2[2], 10) - 1 });
      }
    }
    setActiveSubModal('rangeDate');
  };

  const leftRangeCells = useMemo(
    () => buildCalendarCells(leftCalView.year, leftCalView.month),
    [leftCalView]
  );
  const rightRangeCells = useMemo(
    () => buildCalendarCells(rightCalView.year, rightCalView.month),
    [rightCalView]
  );

  const isRangeSelected = Boolean(startDate && endDate);
  const isFilterSelected = Boolean(selectedFilterId);

  // Label tombol filter ke-2 (Kelas/Mata Pelajaran atau Mata Pelajaran)
  const filterTitleLabel =
    activeCategoryModal === 'lkh' ? 'Mata Pelajaran' : 'Kelas/Mata Pelajaran';

  const selectedFilterDisplayLabel = useMemo(() => {
    if (!selectedFilterId) {
      return activeCategoryModal === 'lkh'
        ? 'Pilih Mata Pelajaran'
        : 'Pilih Kelas/Mata Pelajaran';
    }
    if (selectedFilterId === 'ALL') return 'Semua';

    if (activeCategoryModal === 'lkh') {
      const found = mapelOnlyOptions.find(m => m.id === selectedFilterId);
      return found ? found.label : selectedFilterId;
    } else {
      const found = kelasMapelOptions.find(k => k.id === selectedFilterId);
      return found ? found.label : selectedFilterId;
    }
  }, [selectedFilterId, activeCategoryModal, mapelOnlyOptions, kelasMapelOptions]);

  // Pembentukan Filename sesuai spesifikasi:
  // Presensi: Presensi_Kelas/Mata Pelajaran_RentangTgl.<ext>
  // Nilai: Nilai_Kelas/Mata Pelajaran_RentangTgl.<ext>
  // LKH: LKH_Mata Pelajaran_RentangTgl.<ext>
    const generatedFilename = useMemo(() => {
    if (!activeCategoryModal || !selectedFormat) return '';

    // Untuk LKH: gunakan pola nama resmi acuan MAN 1 Majalengka (LKH_[NamaGuru]_[RentangTgl].[ext])
    if (activeCategoryModal === 'lkh') {
      const startNorm = startDate <= endDate ? startDate : endDate;
      const endNorm = startDate <= endDate ? endDate : startDate;
      return buildOfficialLkhFilename({
        currentUser,
        startDate: startNorm,
        endDate: endNorm,
        format: selectedFormat === 'word' ? 'word' : selectedFormat === 'excel' ? 'excel' : 'pdf',
      });
    }

    const prefix =
      activeCategoryModal === 'presensi'
        ? 'Presensi'
        : 'Nilai';

    const cleanFilterPart = (selectedFilterDisplayLabel || 'Semua')
      .replace(/\s*\/\s*/g, '-')
      .replace(/\s+/g, '_');

    const startLabel = startDate
      ? formatShortDateId(startDate).replace(/\s+/g, '')
      : 'Awal';
    const endLabel = endDate
      ? formatShortDateId(endDate).replace(/\s+/g, '')
      : 'Akhir';
    const rangePart =
      startDate && endDate && startDate === endDate
        ? startLabel
        : `${startLabel}-${endLabel}`;

    const ext =
      selectedFormat === 'pdf'
        ? 'pdf'
        : selectedFormat === 'word'
        ? 'doc'
        : 'xlsx';

    return `${prefix}_${cleanFilterPart}_${rangePart}.${ext}`;
  }, [
    activeCategoryModal,
    selectedFormat,
    selectedFilterDisplayLabel,
    startDate,
    endDate,
  ]);

  // Handler saat salah satu tombol file (PDF, Word, Excel) ditekan
  const handleSelectFileFormat = (format: FileFormat) => {
    if (!isRangeSelected) {
      showToast('Pilih Rentang Tanggal terlebih dahulu!', 'warning');
      return;
    }
    if (!isFilterSelected) {
      showToast(`Pilih ${filterTitleLabel} terlebih dahulu!`, 'warning');
      return;
    }
    setSelectedFormat(format);
  };

  // Eksekusi Download File (PDF, Word, Excel) sesuai kategori, filter, dan filename
  const handleDownloadFile = async () => {
    if (!activeCategoryModal || !selectedFormat || !generatedFilename) return;
    setDownloading(true);

    try {
      const startNorm = startDate <= endDate ? startDate : endDate;
      const endNorm = startDate <= endDate ? endDate : startDate;
      const activeToken = localStorage.getItem('ajar_token') || token;

      // Target daftar pengajaran untuk Presensi / Nilai
      const targetPengajaranList =
        selectedFilterId === 'ALL'
          ? kelasMapelOptions
          : kelasMapelOptions.filter(k => k.id === selectedFilterId);

      const fallbackTargets =
        targetPengajaranList.length > 0
          ? targetPengajaranList
          : pengajaranList.slice(0, 1).map(p => ({
              id: `${p.kelas}|${p.mapelId}`,
              label: `${p.kelas} / ${resolveMapelName(p.mapelId, p.mapelNama)}`,
              kelas: p.kelas,
              mapelId: p.mapelId,
              mapelNama: resolveMapelName(p.mapelId, p.mapelNama),
            }));

      // Filter catatan LKH sesuai Rentang Tanggal & Mata Pelajaran (kegiatan Non-KBM pada rentang tanggal tetap disertakan)
      const filteredLkh = lkhRecords
        .filter(rec => {
          if (!belongsToCurrentGuru(rec)) return false;
          const recDate = normalizeIsoDate(rec.Tanggal || rec.tanggal || '');
          if (!recDate || recDate < startNorm || recDate > endNorm) return false;
          if (selectedFilterId && selectedFilterId !== 'ALL') {
            const isNonKbm = parseHariNonKbm(
              rec.HariNonKBM ?? rec.IsNonKbm ?? rec.isNonKbm
            );
            if (!isNonKbm) {
              const recMapelId = String(rec.MataPelajaranID || rec.mapelId || '').trim();
              if (recMapelId !== selectedFilterId) return false;
            }
          }
          return true;
        })
        .sort((a, b) => {
          const dA = normalizeIsoDate(a.Tanggal || a.tanggal || '');
          const dB = normalizeIsoDate(b.Tanggal || b.tanggal || '');
          return dA.localeCompare(dB);
        });

      // Jika kategori LKH dipilih, gunakan format dokumen resmi LKH (Sampul + Tabel Merge + Pengesahan & Mata Pelajaran Utama)
      if (activeCategoryModal === 'lkh') {
        const lkhExportPayload = {
          filename: generatedFilename,
          startDate: startNorm,
          endDate: endNorm,
          currentUser,
          primaryMapelName,
          records: filteredLkh,
        };

        if (selectedFormat === 'pdf') {
          exportLkhOfficialPdf(lkhExportPayload);
        } else if (selectedFormat === 'word') {
          exportLkhOfficialWord(lkhExportPayload);
        } else {
          exportLkhOfficialExcel(lkhExportPayload);
        }

        showToast(`Berhasil mengunduh ${generatedFilename}`, 'success');
        return;
      }

      // Ambil data Presensi atau Nilai untuk target kelas/mapel
      let absSiswaList: SiswaItem[] = [];
      let absMap: Record<string, Record<string, string>> = {};
      let nilSiswaList: SiswaItem[] = [];
      let nilActMap: Record<string, Record<string, number | null>> = {};
      let nilPasMap: Record<string, number | null> = {};

      if (activeCategoryModal === 'presensi' && fallbackTargets.length > 0) {
        const firstTarget = fallbackTargets[0];
        const res = await callGasApi('getAbsensiData', [
          activeToken,
          firstTarget.kelas,
          firstTarget.mapelId,
          1,
          'Ganjil',
        ]);
        if (res && res.success) {
          absSiswaList = res.siswa || [];
          absMap = res.absensiMap || {};
        }
      } else if (activeCategoryModal === 'nilai' && fallbackTargets.length > 0) {
        const firstTarget = fallbackTargets[0];
        const res = await callGasApi('getNilaiData', [
          activeToken,
          firstTarget.kelas,
          firstTarget.mapelId,
          'Ganjil',
        ]);
        if (res && res.success) {
          nilSiswaList = res.siswa || [];
          nilActMap = res.aktivitasMap || {};
          nilPasMap = res.pasMap || {};
        }
      }

      // 1. EXPORT PDF
      if (selectedFormat === 'pdf') {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(
          'KEMENTERIAN AGAMA REPUBLIK INDONESIA',
          doc.internal.pageSize.getWidth() / 2,
          13,
          { align: 'center' }
        );
        doc.setFontSize(12);
        doc.text(
          'MADRASAH ALIYAH NEGERI 1 MAJALENGKA',
          doc.internal.pageSize.getWidth() / 2,
          19,
          { align: 'center' }
        );
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(
          `Periode: ${formatShortDateId(startNorm)} s.d. ${formatShortDateId(endNorm)} • Filter: ${selectedFilterDisplayLabel}`,
          doc.internal.pageSize.getWidth() / 2,
          25,
          { align: 'center' }
        );
        doc.setLineWidth(0.5);
        doc.line(14, 28, doc.internal.pageSize.getWidth() - 14, 28);

        if (activeCategoryModal === 'presensi') {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.5);
          doc.text(
            `LAPORAN PRESENSI SISWA (${selectedFilterDisplayLabel})`,
            14,
            35
          );
          const head = [
            [
              'No',
              'NIS',
              'Nama Siswa',
              'P1',
              'P2',
              'P3',
              'P4',
              'P5',
              'P6',
              'P7',
              'P8',
              'H',
              'S',
              'I',
              'A',
            ],
          ];
          const body = absSiswaList.map((s, idx) => {
            const sId = s.SiswaID || s.siswaId || '';
            const att = absMap[sId] || {};
            let h = 0,
              sc = 0,
              ic = 0,
              a = 0;
            Object.values(att).forEach(v => {
              if (v === 'H') h++;
              else if (v === 'S') sc++;
              else if (v === 'I') ic++;
              else if (v === 'A') a++;
            });
            const pCols = Array.from({ length: 8 }, (_, i) => att[String(i + 1)] || '-');
            return [
              idx + 1,
              s.NIS || s.nis || '',
              s.NamaSiswa || s.namaSiswa || s.nama || '',
              ...pCols,
              h,
              sc,
              ic,
              a,
            ];
          });
          autoTable(doc, {
            startY: 39,
            head,
            body,
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
            styles: { fontSize: 8, cellPadding: 2 },
          });
        } else if (activeCategoryModal === 'nilai') {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.5);
          doc.text(
            `LAPORAN NILAI SISWA (${selectedFilterDisplayLabel})`,
            14,
            35
          );
          const head = [
            [
              'No',
              'NIS',
              'Nama Siswa',
              'Act 1',
              'Act 2',
              'Act 3',
              'Act 4',
              'Act 5',
              'Rata',
              'PAS',
              'Akhir',
            ],
          ];
          const body = nilSiswaList.map((s, idx) => {
            const sId = s.SiswaID || s.siswaId || '';
            const acts = nilActMap[sId] || {};
            const validActs = Object.values(acts).filter(
              v => typeof v === 'number'
            ) as number[];
            const avgAct =
              validActs.length > 0
                ? Math.round(validActs.reduce((a, b) => a + b, 0) / validActs.length)
                : 0;
            const pasVal = nilPasMap[sId] ?? 0;
            const finalScore = Math.round((avgAct * 66 + pasVal * 34) / 100);
            return [
              idx + 1,
              s.NIS || s.nis || '',
              s.NamaSiswa || s.namaSiswa || s.nama || '',
              acts['act_1'] ?? '-',
              acts['act_2'] ?? '-',
              acts['act_3'] ?? '-',
              acts['act_4'] ?? '-',
              acts['act_5'] ?? '-',
              avgAct,
              pasVal,
              finalScore,
            ];
          });
          autoTable(doc, {
            startY: 39,
            head,
            body,
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
            styles: { fontSize: 8, cellPadding: 2 },
          });
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.5);
          doc.text(
            `LAPORAN JURNAL LKH (${selectedFilterDisplayLabel})`,
            14,
            35
          );
          const head = [['No', 'Tgl', 'Jam Ke', 'Kelas', 'Uraian', 'Hasil']];
          const body = filteredLkh.map((r, idx) => {
            const isNonKbm = parseHariNonKbm(
              r.HariNonKBM ?? r.IsNonKbm ?? r.isNonKbm
            );
            const cleanUraian = String(r.UraianKerja || r.uraian || '-')
              .replace(/^\[Non-KBM\]\s*/i, '')
              .trim();
            return [
              idx + 1,
              formatDateWithDayId(String(r.Tanggal || r.tanggal || '')),
              formatCompactJamKe(r),
              isNonKbm ? '-' : r.Kelas || r.kelas || '-',
              cleanUraian,
              isNonKbm ? '-' : r.Hasil || r.HasilPembelajaran || r.hasil || '-',
            ];
          });
          autoTable(doc, {
            startY: 39,
            head,
            body,
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
            styles: { fontSize: 8, cellPadding: 2 },
          });
        }

        doc.save(generatedFilename);
      }

      // 2. EXPORT EXCEL
      else if (selectedFormat === 'excel') {
        const wb = XLSX.utils.book_new();
        if (activeCategoryModal === 'presensi') {
          const headers = [
            'No',
            'NIS',
            'Nama Siswa',
            ...Array.from({ length: 16 }, (_, i) => `P${i + 1}`),
            'H',
            'S',
            'I',
            'A',
          ];
          const rows = absSiswaList.map((s, idx) => {
            const sId = s.SiswaID || s.siswaId || '';
            const att = absMap[sId] || {};
            const pVals = Array.from({ length: 16 }, (_, i) => att[String(i + 1)] || '-');
            let h = 0,
              sc = 0,
              ic = 0,
              a = 0;
            Object.values(att).forEach(v => {
              if (v === 'H') h++;
              else if (v === 'S') sc++;
              else if (v === 'I') ic++;
              else if (v === 'A') a++;
            });
            return [
              idx + 1,
              s.NIS || s.nis || '',
              s.NamaSiswa || s.namaSiswa || s.nama || '',
              ...pVals,
              h,
              sc,
              ic,
              a,
            ];
          });
          const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
          XLSX.utils.book_append_sheet(wb, ws, 'Presensi');
        } else if (activeCategoryModal === 'nilai') {
          const actHeaders = Array.from({ length: 10 }, (_, i) => `Act ${i + 1}`);
          const headers = [
            'No',
            'NIS',
            'Nama Siswa',
            ...actHeaders,
            'Rata Formatif',
            'PAS',
            'Nilai Akhir',
          ];
          const rows = nilSiswaList.map((s, idx) => {
            const sId = s.SiswaID || s.siswaId || '';
            const acts = nilActMap[sId] || {};
            const actVals = Array.from({ length: 10 }, (_, i) => acts[`act_${i + 1}`] ?? '');
            const validActs = Object.values(acts).filter(
              v => typeof v === 'number'
            ) as number[];
            const avgAct =
              validActs.length > 0
                ? Math.round(validActs.reduce((a, b) => a + b, 0) / validActs.length)
                : 0;
            const pasVal = nilPasMap[sId] ?? 0;
            const finalScore = Math.round((avgAct * 66 + pasVal * 34) / 100);
            return [
              idx + 1,
              s.NIS || s.nis || '',
              s.NamaSiswa || s.namaSiswa || s.nama || '',
              ...actVals,
              avgAct,
              pasVal,
              finalScore,
            ];
          });
          const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
          XLSX.utils.book_append_sheet(wb, ws, 'Nilai');
        } else {
          const headers = ['No', 'Tgl', 'Jam Ke', 'Kelas', 'Uraian', 'Hasil'];
          const rows = filteredLkh.map((r, idx) => {
            const isNonKbm = parseHariNonKbm(
              r.HariNonKBM ?? r.IsNonKbm ?? r.isNonKbm
            );
            const cleanUraian = String(r.UraianKerja || r.uraian || '-')
              .replace(/^\[Non-KBM\]\s*/i, '')
              .trim();
            return [
              idx + 1,
              formatDateWithDayId(String(r.Tanggal || r.tanggal || '')),
              formatCompactJamKe(r),
              isNonKbm ? '-' : r.Kelas || r.kelas || '-',
              cleanUraian,
              isNonKbm ? '-' : r.Hasil || r.HasilPembelajaran || r.hasil || '-',
            ];
          });
          const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
          XLSX.utils.book_append_sheet(wb, ws, 'LKH');
        }
        XLSX.writeFile(wb, generatedFilename);
      }

      // 3. EXPORT WORD (.doc)
      else if (selectedFormat === 'word') {
        let html = `
          <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
          <head><meta charset="utf-8"><title>${generatedFilename}</title>
          <style>
            body { font-family: Calibri, Arial, sans-serif; font-size: 10.5pt; }
            table { border-collapse: collapse; width: 100%; margin-top: 12px; }
            th, td { border: 1px solid #333; padding: 6px; text-align: left; vertical-align: top; }
            th { background-color: #2563EB; color: white; }
          </style>
          </head>
          <body>
            <h3 style="margin:0;">LAPORAN ${activeCategoryModal.toUpperCase()} - MAN 1 MAJALENGKA</h3>
            <p style="margin:4px 0;">Rentang Tanggal: ${formatShortDateId(startNorm)} s.d. ${formatShortDateId(endNorm)} | Filter: ${selectedFilterDisplayLabel}</p>
        `;

        if (activeCategoryModal === 'presensi') {
          html += `<table><tr><th>No</th><th>NIS</th><th>Nama Siswa</th><th>H</th><th>S</th><th>I</th><th>A</th></tr>`;
          absSiswaList.forEach((s, idx) => {
            const sId = s.SiswaID || s.siswaId || '';
            const att = absMap[sId] || {};
            const vals = Object.values(att);
            html += `<tr><td>${idx + 1}</td><td>${s.NIS || ''}</td><td>${s.NamaSiswa || s.nama || ''}</td><td>${vals.filter(v => v === 'H').length}</td><td>${vals.filter(v => v === 'S').length}</td><td>${vals.filter(v => v === 'I').length}</td><td>${vals.filter(v => v === 'A').length}</td></tr>`;
          });
          html += `</table>`;
        } else if (activeCategoryModal === 'nilai') {
          html += `<table><tr><th>No</th><th>NIS</th><th>Nama Siswa</th><th>Act 1</th><th>Act 2</th><th>PAS</th></tr>`;
          nilSiswaList.forEach((s, idx) => {
            const sId = s.SiswaID || s.siswaId || '';
            const acts = nilActMap[sId] || {};
            html += `<tr><td>${idx + 1}</td><td>${s.NIS || ''}</td><td>${s.NamaSiswa || s.nama || ''}</td><td>${acts['act_1'] ?? '-'}</td><td>${acts['act_2'] ?? '-'}</td><td>${nilPasMap[sId] ?? '-'}</td></tr>`;
          });
          html += `</table>`;
        } else {
          html += `<table><tr><th>No</th><th>Tgl</th><th>Jam Ke</th><th>Kelas</th><th>Uraian</th><th>Hasil</th></tr>`;
          filteredLkh.forEach((r, idx) => {
            const isNonKbm = parseHariNonKbm(
              r.HariNonKBM ?? r.IsNonKbm ?? r.isNonKbm
            );
            const cleanUraian = String(r.UraianKerja || r.uraian || '-')
              .replace(/^\[Non-KBM\]\s*/i, '')
              .trim();
            html += `<tr><td>${idx + 1}</td><td>${formatDateWithDayId(String(r.Tanggal || r.tanggal || ''))}</td><td>${formatCompactJamKe(r)}</td><td>${isNonKbm ? '-' : r.Kelas || r.kelas || '-'}</td><td>${cleanUraian}</td><td>${isNonKbm ? '-' : r.Hasil || r.HasilPembelajaran || r.hasil || '-'}</td></tr>`;
          });
          html += `</table>`;
        }

        html += `</body></html>`;
        const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = generatedFilename;
        a.click();
        URL.revokeObjectURL(url);
      }

      showToast(`Berhasil mengunduh ${generatedFilename}`, 'success');
    } catch (err: any) {
      showToast('Gagal mengunduh file: ' + (err?.message || 'Error'), 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col justify-center select-none pb-16 md:pb-4 max-w-xl w-full mx-auto">
      {/* ========================================================================= */}
      {/* TAMPILAN UTAMA: KARTU PRESENSI, NILAI, DAN LKH (CUKUP ICON DAN TULISAN)   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 my-auto">
        {/* KARTU 1: PRESENSI */}
        <button
          type="button"
          onClick={() => handleOpenCategoryModal('presensi')}
          className="min-h-[130px] sm:min-h-[175px] p-5 rounded-3xl neu-raised-card bg-[#EEF2F6] border border-white/90 flex flex-col items-center justify-center gap-3.5 text-center transition-all duration-150 cursor-pointer active:scale-97 hover:border-blue-400/80 group"
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl neu-pressed bg-[#E8EEF6] flex items-center justify-center text-blue-600 border border-white/80 group-hover:text-blue-700 transition-colors">
            <ClipboardCheck className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2]" />
          </div>
          <span className="text-sm sm:text-base font-semibold text-[#0D162B] tracking-tight">
            Presensi
          </span>
        </button>

        {/* KARTU 2: NILAI */}
        <button
          type="button"
          onClick={() => handleOpenCategoryModal('nilai')}
          className="min-h-[130px] sm:min-h-[175px] p-5 rounded-3xl neu-raised-card bg-[#EEF2F6] border border-white/90 flex flex-col items-center justify-center gap-3.5 text-center transition-all duration-150 cursor-pointer active:scale-97 hover:border-blue-400/80 group"
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl neu-pressed bg-[#E8EEF6] flex items-center justify-center text-blue-600 border border-white/80 group-hover:text-blue-700 transition-colors">
            <Award className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2]" />
          </div>
          <span className="text-sm sm:text-base font-semibold text-[#0D162B] tracking-tight">
            Nilai
          </span>
        </button>

        {/* KARTU 3: LKH */}
        <button
          type="button"
          onClick={() => handleOpenCategoryModal('lkh')}
          className="min-h-[130px] sm:min-h-[175px] p-5 rounded-3xl neu-raised-card bg-[#EEF2F6] border border-white/90 flex flex-col items-center justify-center gap-3.5 text-center transition-all duration-150 cursor-pointer active:scale-97 hover:border-blue-400/80 group"
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl neu-pressed bg-[#E8EEF6] flex items-center justify-center text-blue-600 border border-white/80 group-hover:text-blue-700 transition-colors">
            <BookOpen className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2]" />
          </div>
          <span className="text-sm sm:text-base font-semibold text-[#0D162B] tracking-tight">
            LKH
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MODAL MENGAMBANG UTAMA: PRESENSI / NILAI / LKH                            */}
      {/* ========================================================================= */}
      {activeCategoryModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setActiveCategoryModal(null);
            setActiveSubModal(null);
            setSelectedFormat(null);
          }}
          className="fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md neu-raised-card bg-[#EEF2F6] rounded-3xl p-5 sm:p-6 border border-white/90 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
          >
            {/* Header Modal Kategori */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#0D162B]">
                {activeCategoryModal === 'presensi'
                  ? 'Presensi'
                  : activeCategoryModal === 'nilai'
                  ? 'Nilai'
                  : 'LKH'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveCategoryModal(null);
                  setActiveSubModal(null);
                  setSelectedFormat(null);
                }}
                className="w-8 h-8 rounded-xl neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pilihan Filter: Rentang Tanggal & Kelas/Mata Pelajaran (atau Mata Pelajaran untuk LKH) */}
            <div className="space-y-3">
              {/* TOMBOL 1: BULAN (untuk LKH) ATAU RENTANG TANGGAL (untuk Presensi/Nilai) */}
              <button
                type="button"
                onClick={() => {
                  if (activeCategoryModal === 'lkh') {
                    setSelectedYear(new Date().getFullYear());
                    setActiveSubModal('monthPicker');
                  } else {
                    handleOpenRangeDateModal();
                  }
                }}
                className={`w-full min-h-[54px] px-4 py-2.5 rounded-2xl neu-btn bg-[#EEF2F6] flex items-center justify-between gap-3 text-left cursor-pointer transition-all ${
                  isRangeSelected
                    ? 'border-2 border-blue-400/80'
                    : 'border border-white/90'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl neu-pressed bg-[#E8EEF6] flex items-center justify-center text-blue-600 shrink-0">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-semibold text-[#0D162B]">
                      {activeCategoryModal === 'lkh' ? 'Bulan' : 'Rentang Tanggal'}
                    </span>
                    <span
                      className={`block text-[11px] font-mono tabular-nums truncate mt-0.5 ${
                        isRangeSelected ? 'text-blue-700 font-medium' : 'text-slate-400'
                      }`}
                    >
                      {activeCategoryModal === 'lkh'
                        ? lkhPeriodDisplayLabel
                        : isRangeSelected
                        ? `${formatShortDateId(startDate)} - ${formatShortDateId(endDate)}`
                        : 'Pilih Rentang Tanggal'}
                    </span>
                  </div>
                </div>

                {isRangeSelected && (
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                )}
              </button>

              {/* TOMBOL 2: KELAS/MATA PELAJARAN (Presensi & Nilai) ATAU MATA PELAJARAN (LKH) */}
              <button
                type="button"
                onClick={() => setActiveSubModal('filterSelector')}
                className={`w-full min-h-[54px] px-4 py-2.5 rounded-2xl neu-btn bg-[#EEF2F6] flex items-center justify-between gap-3 text-left cursor-pointer transition-all ${
                  isFilterSelected
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
                      {filterTitleLabel}
                    </span>
                    <span
                      className={`block text-[11px] truncate mt-0.5 ${
                        isFilterSelected ? 'text-blue-700 font-medium' : 'text-slate-400'
                      }`}
                    >
                      {selectedFilterDisplayLabel}
                    </span>
                  </div>
                </div>

                {isFilterSelected && (
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                )}
              </button>
            </div>

            {/* BARIS TOMBOL FORMAT FILE: PDF, WORD, EXCEL */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleSelectFileFormat('pdf')}
                className={`min-h-[44px] py-2 px-3 rounded-2xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-97 ${
                  selectedFormat === 'pdf'
                    ? 'neu-pressed bg-[#E2ECF9] text-blue-700 font-semibold border border-blue-400/80'
                    : 'neu-btn bg-[#EEF2F6] text-rose-600 hover:text-rose-700 border border-white/90'
                }`}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>PDF</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectFileFormat('word')}
                className={`min-h-[44px] py-2 px-3 rounded-2xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-97 ${
                  selectedFormat === 'word'
                    ? 'neu-pressed bg-[#E2ECF9] text-blue-700 font-semibold border border-blue-400/80'
                    : 'neu-btn bg-[#EEF2F6] text-blue-600 hover:text-blue-700 border border-white/90'
                }`}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>Word</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectFileFormat('excel')}
                className={`min-h-[44px] py-2 px-3 rounded-2xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-97 ${
                  selectedFormat === 'excel'
                    ? 'neu-pressed bg-[#E2ECF9] text-blue-700 font-semibold border border-blue-400/80'
                    : 'neu-btn bg-[#EEF2F6] text-emerald-600 hover:text-emerald-700 border border-white/90'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>Excel</span>
              </button>
            </div>

            {/* KOTAK FILENAME + TOMBOL DOWNLOAD + TOMBOL "x" */}
            {selectedFormat && generatedFilename && (
              <div className="neu-pressed bg-[#E8EEF6] rounded-2xl p-3 border border-white/80 flex items-center justify-between gap-2 animate-in fade-in duration-150">
                <div className="min-w-0 flex-1">
                  <span className="block text-[11px] font-mono text-[#0D162B] font-medium break-all leading-snug">
                    {generatedFilename}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={downloading}
                    onClick={handleDownloadFile}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl neu-btn-primary text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer active:scale-97 disabled:opacity-50"
                  >
                    {downloading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-white" />
                    )}
                    <span>Download</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedFormat(null)}
                    title="Hilangkan filename"
                    className="w-9 h-9 rounded-xl neu-btn bg-[#EEF2F6] text-rose-600 hover:text-rose-700 flex items-center justify-center cursor-pointer border border-white/90 shrink-0"
                  >
                    <X className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
            {/* SUB-MODAL MENGAMBANG: PILIH BULAN (KHUSUS LKH) */}
      {activeSubModal === 'monthPicker' && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveSubModal(null)}
          className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-xs sm:max-w-sm neu-raised-card bg-[#EEF2F6] rounded-3xl p-4 sm:p-5 border border-white/90 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg neu-pressed bg-[#E8EEF6] text-blue-600 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-[#0D162B]">
                  Pilih Bulan LKH
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveSubModal(null)}
                className="w-8 h-8 rounded-xl neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Tahun (Atas) */}
            <div className="neu-pressed bg-[#E8EEF6] p-2 rounded-2xl border border-white/80 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedYear(prev => prev - 1)}
                className="w-8 h-8 rounded-xl neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-700 hover:text-blue-700 cursor-pointer transition-all active:scale-95"
                title="Tahun Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500">Tahun</span>
                <span className="text-sm font-semibold text-[#0D162B] font-mono tabular-nums">
                  {selectedYear}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedYear(prev => prev + 1)}
                className="w-8 h-8 rounded-xl neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-700 hover:text-blue-700 cursor-pointer transition-all active:scale-95"
                title="Tahun Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Grid 12 Kotak Bulan (JAN - DES) */}
            <div className="grid grid-cols-3 gap-2.5">
              {MONTH_BOXES.map(({ idx, label }) => {
                const ymKey = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;
                const hasData = availableYearMonths.includes(ymKey);
                const isSelected =
                  startDate.startsWith(ymKey) && endDate.startsWith(ymKey);

                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleSelectMonth(idx)}
                    className={`min-h-[46px] p-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'neu-btn-primary text-white font-semibold shadow-xs'
                        : hasData
                        ? 'neu-btn bg-[#EEF2F6] text-[#0D162B] font-semibold border-2 border-blue-400/80 hover:bg-blue-50/50'
                        : 'neu-btn bg-[#EEF2F6] text-slate-600 font-medium border border-white/90 hover:text-blue-700'
                    }`}
                  >
                    <span className="font-mono text-xs tracking-wider">{label}</span>
                    {hasData && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-white' : 'bg-emerald-500'
                        }`}
                        title="Terdapat data jurnal"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tombol Rentang Tanggal (Bawah) */}
            <div className="pt-1 border-t border-slate-200/80">
              <button
                type="button"
                onClick={handleOpenRangeDateModal}
                className="w-full min-h-[40px] px-3.5 py-2 rounded-2xl neu-btn bg-[#EEF2F6] text-xs font-medium text-slate-700 hover:text-blue-700 border border-white/90 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                <span>Rentang Tanggal Khusus</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 1: RENTANG TANGGAL (2 SISI KALENDER SAMA SEPERTI REKAP LKH)     */}
      {/* ========================================================================= */}
      {activeSubModal === 'rangeDate' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#EEF2F6] flex flex-col justify-between p-2.5 sm:p-4 overflow-hidden select-none animate-in fade-in duration-150"
        >
          {/* Header Fullscreen */}
          <div className="shrink-0 flex items-center justify-between gap-2 px-1 pb-1">
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-[#0D162B] block truncate">
                Pilih Rentang Tanggal
              </span>
              <span className="text-[10px] text-slate-500 block truncate">
                {activeCategoryModal === 'lkh' && sortedAvailableDates.length > 0
                  ? `${sortedAvailableDates.length} tanggal tersedia (${formatShortDateId(sortedAvailableDates[0])} s.d. ${formatShortDateId(sortedAvailableDates[sortedAvailableDates.length - 1])})`
                  : loadingLkh
                  ? 'Memuat tanggal...'
                  : 'Tentukan Dari Tgl dan Sampai Tgl'}
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
                onClick={() => setActiveSubModal(null)}
                className="w-8 h-8 rounded-xl neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2 Sisi Kalender Fullscreen Tanpa Scroll Vertikal */}
          <div className="flex-1 min-h-0 grid grid-rows-2 sm:grid-rows-1 sm:grid-cols-2 gap-2 sm:gap-3 overflow-hidden py-1">
            {/* SISI 1: DARI TANGGAL */}
            <div className="neu-pressed bg-[#E8EEF6] rounded-2xl p-2 sm:p-3 border border-white/80 flex flex-col justify-between overflow-hidden">
              <div className="shrink-0 flex items-center justify-between px-1">
                <span className="text-[10.5px] font-semibold text-blue-700">
                  Dari Tgl: {startDate ? formatShortDateId(startDate) : '-'}
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
                  const restrictToLkh =
                    activeCategoryModal === 'lkh' && availableLkhDatesSet.size > 0;
                  const isAvailable = restrictToLkh
                    ? availableLkhDatesSet.has(cell.isoDate)
                    : true;
                  const isSelected = startDate === cell.isoDate;
                  return (
                    <button
                      key={`l-${cell.isoDate}`}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => {
                        if (!isAvailable) return;
                        setStartDate(cell.isoDate);
                        if (!endDate) setEndDate(cell.isoDate);
                        setSelectedFormat(null);
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
                  Sampai Tgl: {endDate ? formatShortDateId(endDate) : '-'}
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
                  const restrictToLkh =
                    activeCategoryModal === 'lkh' && availableLkhDatesSet.size > 0;
                  const isAvailable = restrictToLkh
                    ? availableLkhDatesSet.has(cell.isoDate)
                    : true;
                  const isSelected = endDate === cell.isoDate;
                  return (
                    <button
                      key={`r-${cell.isoDate}`}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => {
                        if (!isAvailable) return;
                        setEndDate(cell.isoDate);
                        if (!startDate) setStartDate(cell.isoDate);
                        setSelectedFormat(null);
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

          {/* Tombol Selesai */}
          <div className="shrink-0 pt-1.5">
            <button
              type="button"
              onClick={() => setActiveSubModal(null)}
              className="w-full min-h-[42px] py-2 rounded-2xl neu-btn-primary text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Selesai</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL 2: DAFTAR KARTU KELAS/MATA PELAJARAN ATAU MATA PELAJARAN        */}
      {/* ========================================================================= */}
      {activeSubModal === 'filterSelector' && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveSubModal(null)}
          className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm neu-raised-card bg-[#EEF2F6] rounded-3xl p-4 sm:p-5 border border-white/90 shadow-2xl space-y-3.5 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#0D162B]">
                {filterTitleLabel}
              </span>
              <button
                type="button"
                onClick={() => setActiveSubModal(null)}
                className="w-8 h-8 rounded-xl neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="neu-pressed bg-[#E8EEF6] p-2.5 rounded-2xl border border-white/80 max-h-64 overflow-y-auto touch-scroll space-y-2">
              {/* Kartu Pilihan: Semua */}
              <button
                type="button"
                onClick={() => {
                  setSelectedFilterId('ALL');
                  setSelectedFormat(null);
                  setActiveSubModal(null);
                }}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-between gap-2 transition-all cursor-pointer text-left ${
                  selectedFilterId === 'ALL'
                    ? 'neu-pressed bg-[#E2ECF9] text-blue-700 font-semibold border border-blue-400/80'
                    : 'neu-flat bg-[#EEF2F6] text-[#0D162B] font-medium hover:text-blue-700 border border-white/90'
                }`}
              >
                <span>Semua</span>
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    selectedFilterId === 'ALL'
                      ? 'bg-emerald-500 text-white'
                      : 'neu-pressed bg-[#E8EEF6] text-transparent'
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
              </button>

              {/* Daftar Kartu: Mata Pelajaran (untuk LKH) atau Kelas/Mata Pelajaran (untuk Presensi & Nilai) */}
              {(activeCategoryModal === 'lkh' ? mapelOnlyOptions : kelasMapelOptions).map(
                item => {
                  const isSelected = selectedFilterId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedFilterId(item.id);
                        setSelectedFormat(null);
                        setActiveSubModal(null);
                      }}
                      className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-between gap-2 transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'neu-pressed bg-[#E2ECF9] text-blue-700 font-semibold border border-blue-400/80'
                          : 'neu-flat bg-[#EEF2F6] text-[#0D162B] font-medium hover:text-blue-700 border border-white/90'
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
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
                }
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
