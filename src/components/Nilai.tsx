import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Award,
  Save,
  Check,
  X,
  Edit2,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Users,
  Sparkles,
} from 'lucide-react';
import { PengajaranItem, SiswaItem, User } from '../types';
import { callGasApi } from '../services/gasApi';

interface NilaiProps {
  token: string;
  pengajaranList: PengajaranItem[];
  currentUser?: User | null;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onNavigate?: (page: string) => void;
}

interface RombelItem {
  id: string; // key: mapelId|kelas
  kelas: string;
  mapelId: string;
  mapelNama: string;
  level: 'X' | 'XI' | 'XII' | null;
}

interface TargetItem {
  key: string;
  label: string;
  shortLabel: string;
  isPas?: boolean;
}

const ASSESSMENT_TARGETS: TargetItem[] = [
  ...Array.from({ length: 16 }, (_, i) => ({
    key: `act_${i + 1}`,
    label: `Aktivitas ${i + 1} (Formatif / TP ${i + 1})`,
    shortLabel: `Formatif ${i + 1}`,
  })),
  {
    key: 'pas',
    label: 'Ujian Akhir Semester (Sumatif / PAS)',
    shortLabel: 'Sumatif (PAS)',
    isPas: true,
  },
];

// Helper format Title Case
const toProperCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ');
};

// Normalisasi data siswa dari berbagai kemungkinan respon backend
const normalizeSiswaItem = (s: any, fallbackClass = ''): SiswaItem => {
  if (!s || typeof s !== 'object') {
    const fallbackId = 's-' + Math.random().toString(36).substring(2, 9);
    return {
      SiswaID: fallbackId,
      siswaId: fallbackId,
      NamaSiswa: 'Siswa',
      Kelas: fallbackClass,
      JenisKelamin: 'L',
    };
  }

  const rawNis = String(s.NIS || s.nis || s.Nis || s['NIS/NISN'] || '').trim();
  const rawNisn = String(s.NISN || s.nisn || s.Nisn || '').trim();
  const sId = String(
    s.SiswaID ||
    s.siswaId ||
    s.id ||
    s.ID ||
    rawNis ||
    rawNisn ||
    's-' + Math.random().toString(36).substring(2, 9)
  ).trim();

  let rawNama = String(
    s.NamaSiswa ||
    s.namaSiswa ||
    s.nama ||
    s.Nama ||
    s.nama_lengkap ||
    s.NamaLengkap ||
    s.name ||
    ''
  ).trim();

  let foundJk = '';
  const potentialJkValues = [
    s.JenisKelamin,
    s.jenisKelamin,
    s.jk,
    s.JK,
    s.Gender,
    s.gender,
    s.Kelamin,
    s.kelamin,
  ];

  for (const val of potentialJkValues) {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      foundJk = String(val).trim().toUpperCase();
      break;
    }
  }

  const genderInNameMatch = rawNama.match(/\s*[\(\[\-\/]\s*([LPWlpw]|Perempuan|Laki-laki|Wanita|Pria)\s*[\)\]]?\s*$/i);
  if (genderInNameMatch) {
    if (!foundJk) {
      foundJk = genderInNameMatch[1].toUpperCase();
    }
    rawNama = rawNama.replace(/\s*[\(\[\-\/]\s*([LPWlpw]|Perempuan|Laki-laki|Wanita|Pria)\s*[\)\]]?\s*$/i, '').trim();
  }
  rawNama = rawNama.replace(/\s*[\(\[]\s*(P|L)\s*[\)\]]/gi, '').trim();

  let jk: 'L' | 'P' = 'L';
  if (
    foundJk.startsWith('P') ||
    foundJk.startsWith('W') ||
    foundJk === 'F' ||
    foundJk === 'FEMALE'
  ) {
    jk = 'P';
  }

  const namaClean = toProperCase(rawNama) || 'Siswa';
  const kelas = String(s.Kelas || s.kelas || fallbackClass).trim();

  return {
    SiswaID: sId,
    siswaId: sId,
    NIS: rawNis || rawNisn,
    nis: rawNis || rawNisn,
    nisn: rawNisn || rawNis,
    NamaSiswa: namaClean,
    namaSiswa: namaClean,
    nama: namaClean,
    Kelas: kelas,
    kelas: kelas,
    JenisKelamin: jk,
    jenisKelamin: jk,
    jk: jk,
  };
};

// Helper natural compare: X < XI < XII
const parseClassLevelRank = (cls: string): number => {
  const u = (cls || '').trim().toUpperCase();
  if (u.startsWith('XII') || u.includes('XII')) return 3;
  if (u.startsWith('XI') || u.includes('XI')) return 2;
  if (u.startsWith('X') || u.includes('X')) return 1;
  return 4;
};

const naturalCompareClasses = (a: string, b: string): number => {
  const rankA = parseClassLevelRank(a);
  const rankB = parseClassLevelRank(b);
  if (rankA !== rankB) return rankA - rankB;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

// Helper perhitungan predikat
const getPredikat = (score: number | ''): { label: string; badgeCls: string } => {
  if (score === '' || score === null || score === undefined) {
    return { label: '-', badgeCls: 'text-slate-400 bg-slate-100/80 border border-slate-200' };
  }
  const num = Number(score);
  if (num >= 90) return { label: 'A', badgeCls: 'text-emerald-800 bg-emerald-100 border border-emerald-300/80 font-bold' };
  if (num >= 80) return { label: 'B', badgeCls: 'text-sky-800 bg-sky-100 border border-sky-300/80 font-bold' };
  if (num >= 75) return { label: 'C', badgeCls: 'text-amber-800 bg-amber-100 border border-amber-300/80 font-bold' };
  return { label: 'D', badgeCls: 'text-rose-800 bg-rose-100 border border-rose-300/80 font-bold' };
};

// Dropdown Komponen Penilaian Tactile Neumorphism
interface NeuTargetSelectProps {
  value: string | null;
  onChange: (targetKey: string) => void;
  savedTargets: Record<string, boolean>;
  placeholder?: string;
}

const NeuTargetSelect: React.FC<NeuTargetSelectProps> = ({
  value,
  onChange,
  savedTargets,
  placeholder = '-- Silakan Pilih Komponen Penilaian --',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedTargetItem = ASSESSMENT_TARGETS.find(t => t.key === value);
  const isSaved = value ? savedTargets[value] : false;

  return (
    <div ref={containerRef} className="relative w-full select-none">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full h-11 rounded-2xl border flex items-center justify-between px-2.5 sm:px-3.5 transition-all duration-150 cursor-pointer ${
          isOpen
            ? 'neu-pressed bg-[#E8EEF6] border-blue-500/80 ring-2 ring-blue-500/20 scale-[0.99]'
            : 'neu-flat bg-[#EEF2F6] hover:bg-[#F4F7FB] border-white/90 active:neu-pressed'
        }`}
      >
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 pr-1">
          <div className="w-6 h-6 rounded-lg neu-inset bg-[#E8EEF6] flex items-center justify-center shrink-0">
            <Award className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <span
            className={`truncate text-xs font-semibold ${
              value ? 'text-[#0D162B]' : 'text-slate-400 font-normal'
            }`}
          >
            {selectedTargetItem ? selectedTargetItem.label : placeholder}
          </span>
          {value && isSaved && (
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg neu-inset bg-[#E8EEF6] border border-emerald-300/60 text-emerald-800 text-[11px] font-medium shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
              Tersimpan
            </span>
          )}
        </div>
        <div className="w-6 h-6 rounded-lg neu-flat bg-[#EEF2F6] flex items-center justify-center shrink-0 border border-white/60">
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-blue-600' : ''
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 neu-raised-card bg-[#EEF2F6] border border-white/90 rounded-2xl p-2 shadow-[8px_14px_30px_rgba(166,182,209,0.5),-8px_-8px_20px_rgba(255,255,255,0.95)] max-h-64 sm:max-h-72 overflow-y-auto no-scrollbar overscroll-contain animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2 py-1.5 mb-1.5 border-b border-[#cbd5e1]/60 flex items-center justify-between text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            <span>Komponen Penilaian Siswa</span>
            <span className="px-2 py-0.5 rounded-md neu-inset bg-[#E8EEF6] text-blue-700 font-medium font-mono tabular-nums">
              17 Komponen
            </span>
          </div>
          <div className="space-y-1.5">
            {ASSESSMENT_TARGETS.map(t => {
              const isSelected = value === t.key;
              const hasData = Boolean(savedTargets[t.key]);

              return (
                <div
                  key={t.key}
                  onClick={() => {
                    onChange(t.key);
                    setIsOpen(false);
                  }}
                  className={`px-3 py-2.5 rounded-xl border flex items-center justify-between text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'neu-pressed bg-[#E2ECF9] border-blue-400 text-blue-900 font-bold shadow-inner'
                      : 'neu-flat bg-[#EEF2F6] hover:bg-[#F2F6FA] border-white/80 text-slate-700 hover:text-slate-900 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-mono tabular-nums shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 text-white font-bold'
                          : hasData
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'neu-inset bg-[#E8EEF6] text-slate-500'
                      }`}
                    >
                      {t.isPas ? 'PAS' : t.key.replace('act_', 'F')}
                    </div>
                    <span className="truncate">{t.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {hasData && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-300/60 text-[10px] font-mono tabular-nums">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                        <span>Tersimpan</span>
                      </span>
                    )}
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 stroke-[2.5]" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const Nilai: React.FC<NilaiProps> = ({
  token,
  pengajaranList,
  currentUser,
  showToast,
  onNavigate,
}) => {
  // Semester & Tahun Ajaran
  const autoSemester = useMemo<'Ganjil' | 'Genap'>(() => {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    return currentMonth >= 7 && currentMonth <= 12 ? 'Ganjil' : 'Genap';
  }, []);

  const tahunAjaran = currentUser?.tahunAjaran || '2026/2027';

  // Daftar rombel dari pengajaranList
  const allRombels = useMemo<RombelItem[]>(() => {
    if (!pengajaranList || pengajaranList.length === 0) return [];

    const map = new Map<string, RombelItem>();
    pengajaranList.forEach(p => {
      const cls = (p.kelas || '').trim();
      const mId = (p.mapelId || '').trim();
      const mNama = (p.mapelNama || mId).trim();
      if (!cls || !mId) return;

      const key = `${mId}|${cls}`;
      if (!map.has(key)) {
        let lvl: 'X' | 'XI' | 'XII' | null = null;
        const u = cls.toUpperCase();
        if (u.startsWith('XII') || u.includes('XII')) lvl = 'XII';
        else if (u.startsWith('XI') || u.includes('XI')) lvl = 'XI';
        else if (u.startsWith('X') || u.includes('X')) lvl = 'X';

        map.set(key, {
          id: key,
          kelas: cls,
          mapelId: mId,
          mapelNama: mNama,
          level: lvl,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const cmp = naturalCompareClasses(a.kelas, b.kelas);
      if (cmp !== 0) return cmp;
      return a.mapelNama.localeCompare(b.mapelNama);
    });
  }, [pengajaranList]);

  // Level selector X, XI, XII dinamis
  const availableLevels = useMemo<('X' | 'XI' | 'XII')[]>(() => {
    const setL = new Set<'X' | 'XI' | 'XII'>();
    allRombels.forEach(r => {
      if (r.level) setL.add(r.level);
    });
    const order: ('X' | 'XI' | 'XII')[] = ['X', 'XI', 'XII'];
    return order.filter(lvl => setL.has(lvl));
  }, [allRombels]);

  const [activeLevel, setActiveLevel] = useState<'X' | 'XI' | 'XII'>('XI');

  useEffect(() => {
    if (availableLevels.length > 0 && !availableLevels.includes(activeLevel)) {
      setActiveLevel(availableLevels[0]);
    }
  }, [availableLevels, activeLevel]);

  // Rombel yang ditampilkan
  const displayedRombels = useMemo(() => {
    if (availableLevels.length === 0) return allRombels;
    return allRombels.filter(r => r.level === activeLevel);
  }, [allRombels, activeLevel, availableLevels]);

  // State Modal Full Screen Lembar Penilaian
  const [selectedRombel, setSelectedRombel] = useState<RombelItem | null>(null);
  const [showFullModal, setShowFullModal] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [savedTargets, setSavedTargets] = useState<Record<string, boolean>>({});

  // State Data Penilaian Siswa
  const [siswaList, setSiswaList] = useState<SiswaItem[]>([]);
  const [scoresMap, setScoresMap] = useState<Record<string, number | ''>>({});
  const [isLocked, setIsLocked] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // State cache jumlah siswa per kelas
  const [classStudentCounts, setClassStudentCounts] = useState<Record<string, number>>({});
  const [emptyClassValidationTarget, setEmptyClassValidationTarget] = useState<RombelItem | null>(null);
  const [isSyncingEmptyClass, setIsSyncingEmptyClass] = useState(false);

  // Muat cache jumlah siswa
  useEffect(() => {
    const counts: Record<string, number> = {};
    allRombels.forEach(r => {
      const cached = localStorage.getItem('ajar_siswa_' + r.kelas);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            counts[r.kelas] = parsed.length;
          }
        } catch {}
      }
    });
    setClassStudentCounts(counts);
  }, [allRombels]);

  // Muat riwayat komponen yang sudah tersimpan
  const loadRombelHistory = async (rombel: RombelItem) => {
    try {
      const res = await callGasApi('getNilaiData', [
        token,
        rombel.kelas,
        rombel.mapelId,
        autoSemester,
        currentUser?.nip || '',
      ]);

      const saved: Record<string, boolean> = {};

      if (res && res.success) {
        // Cek aktivitas 1 - 16
        if (res.aktivitasMap) {
          Object.values(res.aktivitasMap).forEach((studentAct: any) => {
            if (studentAct && typeof studentAct === 'object') {
              Object.entries(studentAct).forEach(([k, val]) => {
                if (val !== undefined && val !== null && val !== '') {
                  saved[k] = true;
                }
              });
            }
          });
        }
        // Cek PAS
        if (res.pasMap) {
          Object.values(res.pasMap).forEach((val: any) => {
            if (val !== undefined && val !== null && val !== '') {
              saved['pas'] = true;
            }
          });
        }
      }

      // Cek juga dari localStorage cache
      const nipSuffix = currentUser?.nip ? `_${currentUser.nip}` : '';
      const cacheKey = `ajar_nilai_${rombel.kelas}_${rombel.mapelId}_${autoSemester}${nipSuffix}`;
      const local = localStorage.getItem(cacheKey);
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (parsed.aktivitasMap) {
            Object.values(parsed.aktivitasMap).forEach((studentAct: any) => {
              if (studentAct && typeof studentAct === 'object') {
                Object.entries(studentAct).forEach(([k, val]) => {
                  if (val !== undefined && val !== null && val !== '') {
                    saved[k] = true;
                  }
                });
              }
            });
          }
          if (parsed.pasMap) {
            Object.values(parsed.pasMap).forEach((val: any) => {
              if (val !== undefined && val !== null && val !== '') {
                saved['pas'] = true;
              }
            });
          }
        } catch {}
      }

      setSavedTargets(saved);
    } catch {}
  };

  // Muat Data Nilai Siswa Ketika Komponen Dipilih
  const loadNilaiData = async (rombel: RombelItem, targetKey: string) => {
    setLoading(true);
    try {
      const res = await callGasApi('getNilaiData', [
        token,
        rombel.kelas,
        rombel.mapelId,
        autoSemester,
        currentUser?.nip || '',
      ]);

      // Ekstraksi siswa
      let rawStudents: any[] = [];
      if (res) {
        if (Array.isArray(res.siswa) && res.siswa.length > 0) rawStudents = res.siswa;
        else if (Array.isArray(res.data) && res.data.length > 0) rawStudents = res.data;
        else if (Array.isArray(res.daftarSiswa) && res.daftarSiswa.length > 0) rawStudents = res.daftarSiswa;
        else if (Array.isArray(res.listSiswa) && res.listSiswa.length > 0) rawStudents = res.listSiswa;
        else if (Array.isArray(res.students) && res.students.length > 0) rawStudents = res.students;
      }

      // Fallback cache lokal siswa jika kosong
      if (rawStudents.length === 0) {
        const cached = localStorage.getItem('ajar_siswa_' + rombel.kelas);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) rawStudents = parsed;
          } catch {}
        }
      }

      // Fallback getMasterSiswa jika masih kosong
      if (rawStudents.length === 0) {
        try {
          const masterRes = await callGasApi('getMasterSiswa', [token, rombel.kelas]);
          const rawMaster = masterRes?.data || masterRes?.siswa || (Array.isArray(masterRes) ? masterRes : []);
          if (Array.isArray(rawMaster) && rawMaster.length > 0) rawStudents = rawMaster;
        } catch {}
      }

      const normalizedStudents = rawStudents.map(s => normalizeSiswaItem(s, rombel.kelas));
      setSiswaList(normalizedStudents);

      if (normalizedStudents.length > 0) {
        localStorage.setItem('ajar_siswa_' + rombel.kelas, JSON.stringify(normalizedStudents));
        setClassStudentCounts(prev => ({ ...prev, [rombel.kelas]: normalizedStudents.length }));
      }

      // Ekstraksi nilai per siswa
      const loadedScores: Record<string, number | ''> = {};
      let hasSavedData = false;

      // Cek cache lokal juga
      const nipSuffix = currentUser?.nip ? `_${currentUser.nip}` : '';
      const cacheKey = `ajar_nilai_${rombel.kelas}_${rombel.mapelId}_${autoSemester}${nipSuffix}`;
      let localCachedData: any = null;
      try {
        const rawLocal = localStorage.getItem(cacheKey);
        if (rawLocal) localCachedData = JSON.parse(rawLocal);
      } catch {}

      normalizedStudents.forEach(s => {
        const sId = s.SiswaID || s.siswaId || '';
        const nis = s.NIS || s.nis || '';

        let val: any = undefined;
        if (targetKey === 'pas') {
          val = res?.pasMap?.[sId] ?? res?.pasMap?.[nis] ?? localCachedData?.pasMap?.[sId] ?? localCachedData?.pasMap?.[nis];
        } else {
          val = res?.aktivitasMap?.[sId]?.[targetKey] ??
                res?.aktivitasMap?.[nis]?.[targetKey] ??
                localCachedData?.aktivitasMap?.[sId]?.[targetKey] ??
                localCachedData?.aktivitasMap?.[nis]?.[targetKey];
        }

        if (val !== undefined && val !== null && val !== '') {
          hasSavedData = true;
          loadedScores[sId] = Number(val);
        } else {
          loadedScores[sId] = '';
        }
      });

      setScoresMap(loadedScores);
      setIsLocked(hasSavedData);
      setIsDirty(!hasSavedData);
    } catch {
      showToast('Gagal memuat data nilai.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRombel = (rombel: RombelItem) => {
    setSelectedRombel(rombel);
    setSelectedTarget(null);
    setSiswaList([]);
    setScoresMap({});
    setIsLocked(false);
    setIsDirty(false);
    setShowFullModal(true);
    loadRombelHistory(rombel);
  };

  const handleCardClick = (rombel: RombelItem) => {
    const studentCount = classStudentCounts[rombel.kelas];
    if (studentCount === 0) {
      setEmptyClassValidationTarget(rombel);
      return;
    }
    handleOpenRombel(rombel);
  };

  const handleSyncEmptyClass = async (rombel: RombelItem) => {
    if (isSyncingEmptyClass) return;
    setIsSyncingEmptyClass(true);
    showToast(`Memeriksa data siswa kelas ${rombel.kelas} di spreadsheet...`, 'info');

    try {
      const res = await callGasApi('getMasterSiswa', [token, rombel.kelas]);
      const raw = res?.data || res?.siswa || (Array.isArray(res) ? res : []);
      if (Array.isArray(raw) && raw.length > 0) {
        const normalized = raw.map(s => normalizeSiswaItem(s, rombel.kelas));
        localStorage.setItem('ajar_siswa_' + rombel.kelas, JSON.stringify(normalized));
        setClassStudentCounts(prev => ({ ...prev, [rombel.kelas]: normalized.length }));
        showToast(`Berhasil menemukan ${normalized.length} siswa untuk kelas ${rombel.kelas}!`, 'success');
        setEmptyClassValidationTarget(null);
        handleOpenRombel(rombel);
      } else {
        showToast(`Belum ada data siswa untuk kelas ${rombel.kelas} di Google Spreadsheet.`, 'warning');
      }
    } catch {
      showToast('Gagal menghubungi spreadsheet madrasah.', 'error');
    } finally {
      setIsSyncingEmptyClass(false);
    }
  };

  const handleTargetChange = (targetKey: string) => {
    setSelectedTarget(targetKey);
    if (selectedRombel) {
      loadNilaiData(selectedRombel, targetKey);
    }
  };

  // Handler ubah nilai satu siswa
  const handleScoreChange = (siswaId: string, valStr: string) => {
    if (isLocked) return;
    setIsDirty(true);

    if (valStr === '') {
      setScoresMap(prev => ({ ...prev, [siswaId]: '' }));
      return;
    }

    const num = Math.min(100, Math.max(0, parseInt(valStr, 10) || 0));
    setScoresMap(prev => ({ ...prev, [siswaId]: num }));
  };

  // Helper isi nilai default KKM (75) untuk siswa yang kosong
  const handleQuickFillKKM = () => {
    if (isLocked) return;
    setIsDirty(true);
    setScoresMap(prev => {
      const next = { ...prev };
      siswaList.forEach(s => {
        const sId = s.SiswaID || s.siswaId || '';
        if (next[sId] === '' || next[sId] === undefined) {
          next[sId] = 75;
        }
      });
      return next;
    });
    showToast('Nilai kosong telah diisi dengan KKM (75)', 'info');
  };

  // Hitung live statistik
  const stats = useMemo(() => {
    let filledCount = 0;
    let sum = 0;
    let max = -1;
    let min = 101;

    Object.values(scoresMap).forEach(v => {
      if (v !== '' && v !== null && v !== undefined && !isNaN(Number(v))) {
        const num = Number(v);
        filledCount++;
        sum += num;
        if (num > max) max = num;
        if (num < min) min = num;
      }
    });

    const avg = filledCount > 0 ? (sum / filledCount).toFixed(1) : '-';
    return {
      filled: filledCount,
      total: siswaList.length,
      avg,
      max: max >= 0 ? max : '-',
      min: min <= 100 ? min : '-',
    };
  }, [scoresMap, siswaList]);

  const canSave = isDirty && !saving && !isLocked && selectedTarget !== null;

  // Handler simpan nilai ke backend
  const handleSave = async () => {
    if (!selectedRombel || !selectedTarget || !canSave) return;
    setSaving(true);

    try {
      const payload = {
        kelas: selectedRombel.kelas,
        mapelId: selectedRombel.mapelId,
        semester: autoSemester,
        target: selectedTarget,
        scores: scoresMap,
        guruNip: currentUser?.nip || '',
      };

      const res = await callGasApi('saveNilaiData', [token, payload]);
      if (res && res.success) {
        showToast('Nilai peserta didik berhasil disimpan!', 'success');
        setIsDirty(false);
        setIsLocked(true);
        setSavedTargets(prev => ({ ...prev, [selectedTarget]: true }));

        // Simpan ke cache lokal
        const nipSuffix = currentUser?.nip ? `_${currentUser.nip}` : '';
        const cacheKey = `ajar_nilai_${selectedRombel.kelas}_${selectedRombel.mapelId}_${autoSemester}${nipSuffix}`;
        let localData = {
          aktivitasMap: {} as any,
          pasMap: {} as any,
        };
        try {
          const raw = localStorage.getItem(cacheKey);
          if (raw) localData = JSON.parse(raw);
        } catch {}

        if (selectedTarget === 'pas') {
          localData.pasMap = { ...(localData.pasMap || {}), ...scoresMap };
        } else {
          if (!localData.aktivitasMap) localData.aktivitasMap = {};
          Object.entries(scoresMap).forEach(([sId, val]) => {
            if (!localData.aktivitasMap[sId]) localData.aktivitasMap[sId] = {};
            localData.aktivitasMap[sId][selectedTarget] = val;
          });
        }
        localStorage.setItem(cacheKey, JSON.stringify(localData));
      } else {
        showToast(res?.message || 'Gagal menyimpan nilai.', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col min-h-0 select-none overflow-hidden text-slate-800 antialiased gap-3">
      {/* ========================================================================= */}
      {/* 1. HALAMAN AWAL: JUDUL SEMESTER OTOMATIS */}
      {/* ========================================================================= */}
      <div className="shrink-0 text-center pt-1 pb-1">
        <h2 className="text-sm font-semibold text-[#0D162B] tracking-tight uppercase">
          Semester {autoSemester}
        </h2>
        <p className="text-[11px] font-medium text-blue-700 font-mono tabular-nums tracking-wider mt-0.5">
          Tahun Ajaran {tahunAjaran}
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 2. PANEL TINGKATAN KELAS FIXED (X, XI, XII Sesuai Master Ajar) */}
      {/* ========================================================================= */}
      {availableLevels.length > 0 && (
        <div className="shrink-0 sticky top-0 z-10 w-full pb-1">
          <div className="p-1 rounded-2xl neu-pressed bg-[#E8EEF6] flex gap-1.5 w-full max-w-sm mx-auto shadow-inner">
            {availableLevels.map(lvl => {
              const isActive = activeLevel === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setActiveLevel(lvl)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'neu-flat bg-[#EEF2F6] text-blue-700 shadow-xs scale-[1.01]'
                      : 'text-slate-500 hover:text-slate-800 font-normal'
                  }`}
                >
                  Tingkat {lvl}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. DAFTAR KARTU KELAS & MATA PELAJARAN (Scrollable overscroll-contain) */}
      {/* ========================================================================= */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar overscroll-contain touch-pan-y space-y-2.5 pb-8 pr-0.5">
        {displayedRombels.length > 0 ? (
          <>
            {displayedRombels.map(rombel => {
              const studentCount = classStudentCounts[rombel.kelas];
              const isClassEmpty = studentCount === 0;

              return (
                <div
                  key={rombel.id}
                  onClick={() => handleCardClick(rombel)}
                  className="w-full neu-raised-card bg-[#EEF2F6] hover:bg-[#F2F6FA] rounded-2xl p-3.5 sm:p-4 flex items-center justify-between border border-white/80 cursor-pointer active:scale-[0.99] transition-all shadow-xs group"
                >
                  {/* Sisi Kiri: Ikon Kelas & Mata Pelajaran */}
                  <div className="flex items-center space-x-3 min-w-0 pr-2">
                    <div className="w-11 h-11 rounded-2xl neu-inset bg-[#E8EEF6] text-blue-600 flex items-center justify-center shrink-0 shadow-inner group-hover:text-blue-700 transition-colors">
                      <Award className="w-5 h-5 stroke-[2.4]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-[#0D162B] tracking-tight truncate leading-none">
                          Kelas {rombel.kelas}
                        </h3>
                        {isClassEmpty && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg neu-inset bg-[#FFF7ED] border border-amber-300/60 text-amber-800 text-[11px] font-medium shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.9)]" />
                            Belum Ada Siswa
                          </span>
                        )}
                        {typeof studentCount === 'number' && studentCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md neu-inset bg-[#E8EEF6] text-slate-500 text-[11px] font-mono tabular-nums font-normal shrink-0">
                            <Users className="w-2.5 h-2.5 text-blue-600" />
                            {studentCount} siswa
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-blue-700 font-medium mt-1 truncate">
                        {rombel.mapelNama}
                      </p>
                    </div>
                  </div>

                  {/* Sisi Kanan: Tombol Aksen Buka Penilaian */}
                  <div className="flex items-center space-x-1.5 shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors">
                    {isClassEmpty ? (
                      <span className="text-[11px] font-medium text-amber-700 uppercase tracking-wider hidden sm:inline">
                        Perlu Data Siswa
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium uppercase tracking-wider hidden sm:inline">
                        Buka Penilaian
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 stroke-[3]" />
                  </div>
                </div>
              );
            })}
            <div className="h-32 sm:h-20 shrink-0 w-full pointer-events-none" aria-hidden="true" />
          </>
        ) : (
          <div className="text-center py-12 neu-raised-card bg-[#EEF2F6] rounded-3xl p-6 text-slate-500">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">Tidak ada rombel mengajar di tingkat ini</p>
            <p className="text-[11px] text-slate-400 font-normal mt-0.5">
              Pastikan Anda telah mengonfigurasi rombel mengajar di Master Ajar.
            </p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. FORMULIR FULL-SCREEN LEMBAR PENILAIAN */}
      {/* ========================================================================= */}
      {showFullModal && selectedRombel && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            className="w-full h-full max-w-4xl max-h-[96vh] neu-raised-card bg-[#EEF2F6] rounded-[24px] sm:rounded-[28px] border border-white/90 shadow-2xl flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* BILAH ATAS: INFO ROMBEL & TOMBOL X KEMBALI */}
            <div className="p-3 sm:p-4 border-b border-[#d4deeb] bg-[#EEF2F6] shrink-0 flex items-center justify-between gap-2">
              <div className="min-w-0 pr-1">
                <h2 className="text-sm font-semibold text-[#0D162B] tracking-tight truncate">
                  Kelas {selectedRombel.kelas} • {selectedRombel.mapelNama}
                </h2>
                <p className="text-[11px] font-medium text-blue-700 font-mono tabular-nums mt-0.5">
                  Semester {autoSemester} • T.A {tahunAjaran}
                </p>
              </div>

              {/* TOMBOL X DI KANAN ATAS UNTUK KEMBALI KE DAFTAR KELAS */}
              <button
                type="button"
                onClick={() => {
                  setShowFullModal(false);
                  setSelectedRombel(null);
                  setIsDirty(false);
                }}
                className="p-1.5 sm:p-2 rounded-xl neu-flat active:neu-pressed text-slate-500 hover:text-slate-900 cursor-pointer border border-white/80 active:scale-95 transition-all"
                title="Tutup & Kembali ke Daftar Rombel"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* FILTER KOMPONEN PENILAIAN (MODERN NEUMORPHISM SOFT UI) */}
            <div className="px-3 sm:px-4 py-2.5 border-b border-[#d4deeb] bg-[#EEF2F6] shrink-0">
              <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                Pilih Komponen / Aktivitas Penilaian
              </label>
              <NeuTargetSelect
                value={selectedTarget}
                onChange={handleTargetChange}
                savedTargets={savedTargets}
                placeholder="-- Silakan Pilih Komponen Penilaian --"
              />
            </div>

            {/* ========================================================================= */}
            {/* KONTEN UTAMA: STATE BELUM PILIH KOMPONEN VS LEMBAR NILAI SISWA */}
            {/* ========================================================================= */}
            {selectedTarget === null ? (
              /* A. STATE AWAL: TAMPILAN SILAKAN PILIH KOMPONEN */
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center select-none space-y-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[28px] neu-inset bg-[#E8EEF6] text-blue-600 flex items-center justify-center shadow-inner">
                  <Award className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.2]" />
                </div>
                <div className="max-w-md space-y-1.5">
                  <h3 className="text-base sm:text-lg font-semibold text-[#0D162B] tracking-tight">
                    Silakan Pilih Komponen Penilaian
                  </h3>
                  <p className="text-xs text-slate-500 font-normal leading-relaxed">
                    Pilih komponen penilaian pada filter di atas untuk memuat daftar peserta didik kelas <span className="font-semibold text-[#0D162B]">{selectedRombel.kelas}</span> mata pelajaran <span className="font-medium text-blue-700">{selectedRombel.mapelNama}</span>.
                  </p>
                </div>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl neu-pressed bg-[#E8EEF6] text-[11px] font-medium text-slate-600">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                    Menunggu Pilihan Komponen
                  </span>
                </div>
              </div>
            ) : (
              /* B. LEMBAR PENILAIAN SISWA SETELAH KOMPONEN DIPILIH */
              <>
                {/* SUB-HEADER: LIVE STATISTIK NILAI & QUICK ACTION */}
                <div className="px-3 sm:px-4 py-2 border-b border-[#d4deeb] bg-[#EEF2F6] shrink-0 flex items-center justify-between gap-2 select-none">
                  {/* Quick Action: Set KKM (75) */}
                  <button
                    type="button"
                    onClick={handleQuickFillKKM}
                    disabled={isLocked}
                    className={`py-1.5 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs ${
                      isLocked
                        ? 'neu-pressed text-slate-400 opacity-50 cursor-not-allowed'
                        : 'neu-btn bg-[#EEF2F6] text-blue-700 hover:text-blue-800 active:scale-95 cursor-pointer'
                    }`}
                    title="Isi nilai kosong dengan KKM (75)"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Set KKM (75)</span>
                  </button>

                  {/* Statistik Live: Rata-rata, Max, Min, Terisi */}
                  <div className="flex items-center space-x-1 sm:space-x-1.5 text-[11px] font-medium font-mono tabular-nums">
                    <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800" title="Rata-rata Kelas">
                      Avg: {stats.avg}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800" title="Nilai Tertinggi">
                      Max: {stats.max}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800" title="Nilai Terendah">
                      Min: {stats.min}
                    </span>
                    <span className="hidden sm:inline-flex px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700" title="Jumlah Siswa Terisi">
                      {stats.filled}/{stats.total}
                    </span>
                  </div>
                </div>

                {/* TABEL LIST SISWA */}
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
                  {/* Header Kolom Tabel (Sticky / Tetap di Atas) */}
                  <div className="shrink-0 bg-[#E2E8F0]/90 border-b border-[#cbd5e1] text-[11px] font-medium text-slate-700 flex items-center px-3 py-2 select-none uppercase tracking-wider">
                    <div className="w-[10%] text-center">No.</div>
                    <div className="w-[52%] pl-1">Nama Siswa</div>
                    <div className="w-[23%] text-center">Nilai</div>
                    <div className="w-[15%] text-center">Predikat</div>
                  </div>

                  {/* Area Baris Siswa (Scrollable Vertikal) */}
                  <div
                    className={`flex-1 min-h-0 overflow-y-auto no-scrollbar transition-all duration-200 ${
                      isLocked ? 'filter blur-[1.5px] pointer-events-none select-none' : ''
                    }`}
                  >
                    {loading ? (
                      <div className="text-center py-12 text-blue-700 text-xs font-medium animate-pulse">
                        Memuat data nilai peserta didik...
                      </div>
                    ) : siswaList.length > 0 ? (
                      siswaList.map((s, idx) => {
                        const sId = s.SiswaID || s.siswaId || `s-${idx}`;
                        const nama = s.NamaSiswa || s.namaSiswa || s.nama || '-';
                        const scoreVal = scoresMap[sId] !== undefined ? scoresMap[sId] : '';
                        const pred = getPredikat(scoreVal);

                        return (
                          <div
                            key={sId}
                            className={`flex items-center px-3 py-1.5 text-xs border-b border-slate-200/60 select-none transition-colors ${
                              idx % 2 === 0 ? 'bg-[#EEF2F6]' : 'bg-[#EAF0F8]'
                            }`}
                          >
                            {/* No */}
                            <div className="w-[10%] text-center font-normal font-mono text-slate-500 tabular-nums text-[11px]">
                              {idx + 1}
                            </div>

                            {/* Nama Siswa */}
                            <div className="w-[52%] pl-1 font-medium text-[#0D162B] truncate pr-1">
                              <span className="truncate">{nama}</span>
                            </div>

                            {/* Input Nilai 0 - 100 */}
                            <div className="w-[23%] flex items-center justify-center">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                disabled={isLocked}
                                value={scoreVal}
                                onChange={e => handleScoreChange(sId, e.target.value)}
                                placeholder="0"
                                className={`w-16 h-8 text-center text-xs font-bold font-mono tabular-nums text-blue-700 rounded-xl neu-inset bg-[#E8EEF6] border border-white/80 outline-none transition-all ${
                                  isLocked
                                    ? 'opacity-60 cursor-not-allowed'
                                    : 'hover:border-blue-300 focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20'
                                }`}
                              />
                            </div>

                            {/* Predikat Nilai (A/B/C/D) */}
                            <div className="w-[15%] flex items-center justify-center">
                              <span className={`w-6 h-6 rounded-lg text-xs font-mono font-medium flex items-center justify-center shrink-0 ${pred.badgeCls}`}>
                                {pred.label}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-10 text-slate-400 text-xs font-normal">
                        Tidak ada data siswa untuk kelas ini.
                      </div>
                    )}
                  </div>

                  {/* OVERLAY STATUS SUBMITTED: Ditampilkan Saat Data Sudah Pernah Disimpan */}
                  {isLocked && !loading && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-slate-900/15 backdrop-blur-[2px] animate-in fade-in duration-150">
                      <div className="neu-raised-card bg-[#EEF2F6] rounded-[24px] p-5 sm:p-6 border border-white/90 shadow-2xl flex flex-col sm:flex-row items-center gap-4 max-w-sm w-full text-center sm:text-left animate-in zoom-in-95 duration-150">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-inner">
                          <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-medium tracking-wide uppercase mb-1">
                            <Check className="w-3 h-3 stroke-[3]" />
                            Submitted
                          </div>
                          <p className="text-xs text-slate-600 font-normal">
                            Nilai komponen telah tersimpan di sistem
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsLocked(false);
                            setIsDirty(true);
                            showToast('Kunci nilai dibuka. Silakan sesuaikan nilai lalu simpan kembali.', 'info');
                          }}
                          className="w-full sm:w-auto py-2 px-3.5 rounded-xl neu-btn bg-[#EEF2F6] text-blue-700 hover:text-blue-800 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shrink-0 border border-white/80 shadow-xs"
                          title="Buka Kunci untuk Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Edit Nilai</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* BILAH DOK BAWAH KHUSUS (STICKY BOTTOM DOCK) */}
                <div className="p-3 bg-[#EEF2F6]/95 backdrop-blur-md border-t border-[#d4deeb] shrink-0">
                  {isLocked ? (
                    <div className="flex items-center justify-between gap-3 p-2 rounded-2xl neu-pressed bg-[#E8EEF6] border border-emerald-200/60">
                      <div className="flex items-center gap-2 pl-2 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-medium text-emerald-800 truncate">
                          Status: Submitted (Data Nilai Tersimpan)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsLocked(false);
                          setIsDirty(true);
                          showToast('Kunci nilai dibuka. Silakan sesuaikan nilai lalu simpan kembali.', 'info');
                        }}
                        className="px-4 py-2 rounded-xl neu-btn bg-[#EEF2F6] text-blue-700 hover:text-blue-800 text-xs font-medium flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shrink-0 border border-white/80 shadow-xs"
                      >
                        <Edit2 className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Edit Nilai</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!canSave}
                      className={`w-full h-12 rounded-2xl font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        canSave
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 active:scale-98'
                          : 'neu-pressed bg-[#E8EEF6] text-slate-400 cursor-not-allowed opacity-60'
                      }`}
                    >
                      {saving ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Menyimpan Nilai...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Simpan Data Nilai</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL VALIDASI: KELAS BELUM ADA SISWANYA */}
      {/* ========================================================================= */}
      {emptyClassValidationTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            className="w-full max-w-md neu-raised-card bg-[#EEF2F6] rounded-[24px] sm:rounded-[28px] border border-white/90 shadow-2xl p-5 sm:p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl neu-inset bg-[#FFF7ED] text-amber-600 flex items-center justify-center shrink-0 shadow-inner border border-amber-300/40">
                  <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#0D162B] tracking-tight">
                    Data Siswa Belum Tersedia
                  </h3>
                  <p className="text-[11px] font-medium text-amber-700 font-mono mt-0.5">
                    Kelas {emptyClassValidationTarget.kelas} • {emptyClassValidationTarget.mapelNama}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmptyClassValidationTarget(null)}
                className="p-1.5 rounded-xl neu-flat active:neu-pressed text-slate-400 hover:text-slate-700 cursor-pointer border border-white/80"
                title="Tutup Dialog"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl neu-inset bg-[#E8EEF6] border border-slate-200/60 text-xs text-slate-600 font-normal leading-relaxed space-y-1.5">
              <p>
                Kelas <span className="font-semibold text-[#0D162B]">{emptyClassValidationTarget.kelas}</span> belum memiliki daftar siswa di aplikasi ini.
              </p>
              <p className="text-[11px] text-slate-500">
                Silakan sinkronkan langsung data dari Spreadsheet atau tambahkan siswa melalui menu Data Siswa terlebih dahulu.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setEmptyClassValidationTarget(null)}
                className="px-4 py-2.5 rounded-xl neu-flat active:neu-pressed text-xs font-medium text-slate-600 hover:text-slate-800 cursor-pointer border border-white/80"
              >
                Tutup
              </button>

              <button
                type="button"
                disabled={isSyncingEmptyClass}
                onClick={() => handleSyncEmptyClass(emptyClassValidationTarget)}
                className="px-4 py-2.5 rounded-xl neu-btn-primary text-xs font-medium text-white flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingEmptyClass ? 'animate-spin' : ''}`} />
                <span>{isSyncingEmptyClass ? 'Menyinkronkan...' : 'Sinkronkan Siswa'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
