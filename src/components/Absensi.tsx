import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  BookOpen,
  Save,
  Check,
  X,
  Edit2,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Upload,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  UserX,
  Users,
} from 'lucide-react';
import { PengajaranItem, SiswaItem, User } from '../types';
import { callGasApi } from '../services/gasApi';

interface AbsensiProps {
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

interface NeuMeetingSelectProps {
  value: number | null;
  onChange: (meet: number | null) => void;
  savedMeetings: Record<number, string>;
  placeholder?: string;
}

// Helper untuk format teks Title Case
const toProperCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ');
};

// Helper normalisasi struktur data siswa dari berbagai kemungkinan respon backend
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

// Helper natural compare pengurutan kelas: X < XI < XII, dan 1 < 2 < ... < 9 < 10 < 11 < 12
const parseClassLevelRank = (cls: string): number => {
  const u = (cls || '').trim().toUpperCase();
  if (u.startsWith('XII') || u.includes('XII')) return 3;
  if (u.startsWith('XI') || u.includes('XI')) return 2;
  if (u.startsWith('X') || u.includes('X')) return 1;
  return 4;
};

export const naturalCompareClasses = (a: string, b: string): number => {
  const rankA = parseClassLevelRank(a);
  const rankB = parseClassLevelRank(b);
  if (rankA !== rankB) return rankA - rankB;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

// Komponen Dropdown List Pertemuan Bertema Murni Modern Soft UI / Tactile Neumorphism (Bebas simbol #)
const NeuMeetingSelect: React.FC<NeuMeetingSelectProps> = ({
  value,
  onChange,
  savedMeetings,
  placeholder = '-- Silakan Pilih Pertemuan (1 - 31) --',
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

  const activeSavedDate = value ? savedMeetings[value] : undefined;

  return (
    <div ref={containerRef} className="relative w-full select-none">
      {/* Trigger Button Tactile Neumorphic (Raised saat diam, Inset saat terbuka/ditekan) */}
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
            <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <span
            className={`truncate text-xs font-semibold ${
              value ? 'text-[#0D162B]' : 'text-slate-400 font-normal'
            }`}
          >
            {value ? `Pertemuan ${value}` : placeholder}
          </span>
          {value && activeSavedDate && (
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

      {/* Popover Menu Neumorphic (Shadow Fisik Ganda Halus, Border Kristal Putih) */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 neu-raised-card bg-[#EEF2F6] border border-white/90 rounded-2xl p-2 shadow-[8px_14px_30px_rgba(166,182,209,0.5),-8px_-8px_20px_rgba(255,255,255,0.95)] max-h-64 sm:max-h-72 overflow-y-auto no-scrollbar overscroll-contain animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2 py-1.5 mb-1.5 border-b border-[#cbd5e1]/60 flex items-center justify-between text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            <span>Daftar Pertemuan Presensi</span>
            <span className="px-2 py-0.5 rounded-md neu-inset bg-[#E8EEF6] text-blue-700 font-medium font-mono tabular-nums">
              1 - 31
            </span>
          </div>
          <div className="space-y-1.5">
            {Array.from({ length: 31 }, (_, i) => i + 1).map(p => {
              const isSelected = value === p;
              const isSaved = Boolean(savedMeetings[p]);
              const savedDate = savedMeetings[p];

              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    onChange(p);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer text-left border ${
                    isSelected
                      ? 'neu-pressed bg-[#E2ECF9] border-blue-400 text-blue-900 shadow-inner scale-[0.99]'
                      : 'neu-flat bg-[#EEF2F6] hover:bg-[#F5F8FC] border-white/80 active:neu-pressed text-[#1E2430] hover:text-blue-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 shadow-[0_0_6px_rgba(37,99,235,0.8)]'
                          : isSaved
                          ? 'bg-emerald-500'
                          : 'bg-slate-300'
                      }`}
                    />
                    <span className="truncate">Pertemuan {p}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSaved && (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-medium border ${
                          isSelected
                            ? 'bg-blue-100/80 text-blue-900 border-blue-300'
                            : 'neu-inset bg-[#E8EEF6] border-emerald-300/50 text-emerald-800'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
                        <span>Tersimpan{savedDate ? ` • ${savedDate}` : ''}</span>
                      </span>
                    )}
                    {isSelected && !isSaved && (
                      <span className="px-2 py-0.5 rounded-lg bg-blue-600 text-white text-[11px] font-medium shadow-xs">
                        Aktif
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const Absensi: React.FC<AbsensiProps> = ({
  token,
  pengajaranList = [],
  currentUser,
  showToast,
  onNavigate,
}) => {
  // 1. Deteksi Otomatis Semester Berdasarkan Tanggal Kalender Nyata
  // Bulan Juli - Desember (7 - 12) = Semester Ganjil, Januari - Juni (1 - 6) = Semester Genap
  const currentMonth = new Date().getMonth() + 1;
  const autoSemester: 'Ganjil' | 'Genap' =
    currentMonth >= 7 && currentMonth <= 12 ? 'Ganjil' : 'Genap';
  const tahunAjaran = '2026/2027';

  // Helper untuk menentukan tingkat kelas (X, XI, atau XII)
  const getClassLevel = useCallback((clsName: string): 'X' | 'XI' | 'XII' | null => {
    const u = clsName.trim().toUpperCase();
    if (u.startsWith('XII') || u.includes('XII')) return 'XII';
    if (u.startsWith('XI') || u.includes('XI')) return 'XI';
    if (u.startsWith('X') || u.includes('X')) return 'X';
    return null;
  }, []);

  // 2. Ekstraksi Daftar Rombel Mengajar (Mapel + Kelas) dari Master Ajar dengan Natural Sort
  // Memastikan urutan kelas dari angka terkecil ke terbesar: XI.1, XI.2, ... XI.9, XI.10, XI.11
  const rombelList = useMemo<RombelItem[]>(() => {
    const map = new Map<string, RombelItem>();
    pengajaranList.forEach(p => {
      const k = (p.Kelas || p.kelas || '').trim();
      const mId = (p.mapelId || (p as any).MataPelajaranID || '').trim();
      const mNama = (p.mapelNama || p.mapelId || 'Mata Pelajaran').trim();

      if (k && mId) {
        const key = `${mId}|${k}`;
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            kelas: k,
            mapelId: mId,
            mapelNama: mNama,
            level: getClassLevel(k),
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => naturalCompareClasses(a.kelas, b.kelas));
  }, [pengajaranList, getClassLevel]);

  // 3. Panel Tingkatan Kelas Fixed: Hanya menampilkan tingkat yang benar-benar diajar guru
  const availableLevels = useMemo(() => {
    const set = new Set<'X' | 'XI' | 'XII'>();
    rombelList.forEach(r => {
      if (r.level) set.add(r.level);
    });
    const order: ('X' | 'XI' | 'XII')[] = ['X', 'XI', 'XII'];
    return order.filter(lvl => set.has(lvl));
  }, [rombelList]);

  const [activeLevel, setActiveLevel] = useState<'X' | 'XI' | 'XII' | null>(() => {
    return availableLevels.length > 0 ? availableLevels[0] : 'XI';
  });

  useEffect(() => {
    if (availableLevels.length > 0 && (!activeLevel || !availableLevels.includes(activeLevel))) {
      setActiveLevel(availableLevels[0]);
    }
  }, [availableLevels, activeLevel]);

  // Filter daftar rombel sesuai tingkat yang aktif (selalu diurutkan natural dari terkecil ke terbesar)
  const displayedRombels = useMemo(() => {
    const list = !activeLevel ? rombelList : rombelList.filter(r => r.level === activeLevel);
    return [...list].sort((a, b) => naturalCompareClasses(a.kelas, b.kelas));
  }, [rombelList, activeLevel]);

  // State pelacakan jumlah siswa tiap kelas & validasi kelas kosong
  const [classStudentCounts, setClassStudentCounts] = useState<Record<string, number>>({});
  const [emptyClassValidationTarget, setEmptyClassValidationTarget] = useState<RombelItem | null>(null);
  const [isSyncingEmptyClass, setIsSyncingEmptyClass] = useState(false);

  // Background scanner: cek keberadaan data siswa untuk setiap kelas rombel
  useEffect(() => {
    if (!displayedRombels || displayedRombels.length === 0) return;

    let isSubscribed = true;
    const initialCounts: Record<string, number> = {};
    const uncountedClasses: string[] = [];

    // Baca dari cache lokal terlebih dahulu untuk respons instan
    displayedRombels.forEach(r => {
      const cached = localStorage.getItem('ajar_siswa_' + r.kelas);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            initialCounts[r.kelas] = parsed.length;
            return;
          }
        } catch {}
      }
      if (classStudentCounts[r.kelas] === undefined) {
        uncountedClasses.push(r.kelas);
      }
    });

    if (Object.keys(initialCounts).length > 0) {
      setClassStudentCounts(prev => ({ ...prev, ...initialCounts }));
    }

    // Prefetch kelas yang belum ada di cache secara asinkron
    if (uncountedClasses.length > 0 && token) {
      const uniqueClasses = Array.from(new Set(uncountedClasses));
      Promise.allSettled(
        uniqueClasses.map(async cls => {
          try {
            const res = await callGasApi('getMasterSiswa', [token, cls]);
            const raw = res?.data || res?.siswa || (Array.isArray(res) ? res : []);
            if (Array.isArray(raw)) {
              const normalized = raw.map(s => normalizeSiswaItem(s, cls));
              if (normalized.length > 0) {
                localStorage.setItem('ajar_siswa_' + cls, JSON.stringify(normalized));
              }
              if (isSubscribed) {
                setClassStudentCounts(prev => ({ ...prev, [cls]: normalized.length }));
              }
            } else if (isSubscribed) {
              setClassStudentCounts(prev => ({ ...prev, [cls]: 0 }));
            }
          } catch {
            if (isSubscribed) {
              setClassStudentCounts(prev => ({ ...prev, [cls]: 0 }));
            }
          }
        })
      );
    }

    return () => {
      isSubscribed = false;
    };
  }, [displayedRombels, token]);

  // 4. State Formulir Full-Screen Presensi
  const [selectedRombel, setSelectedRombel] = useState<RombelItem | null>(null);
  const [showFullModal, setShowFullModal] = useState(false);
  const [pertemuan, setPertemuan] = useState<number | null>(null); // Initial: Belum dipilih!
  const [tanggal, setTanggal] = useState<string>(''); // Muncul setelah pertemuan dipilih
  const [savedMeetings, setSavedMeetings] = useState<Record<number, string>>({}); // { [pertemuan]: tanggal }

  const [siswaList, setSiswaList] = useState<SiswaItem[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'H' | 'I' | 'S' | 'A'>>({});
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false); // Terkunci jika pertemuan sudah berstatus Submitted

  // 5. Muat Ringkasan Riwayat Pertemuan Tersimpan untuk Rombel Ini
  const loadRombelHistory = async (rombel: RombelItem) => {
    try {
      const res = await callGasApi('getAbsensiData', [
        token,
        rombel.kelas,
        rombel.mapelId,
        0,
        autoSemester,
        currentUser?.nip || '',
      ]);
      if (res && res.success && res.datesMap) {
        const saved: Record<number, string> = {};
        Object.entries(res.datesMap).forEach(([k, dateVal]) => {
          const num = parseInt(k, 10);
          if (!isNaN(num) && dateVal) {
            saved[num] = String(dateVal);
          }
        });
        setSavedMeetings(saved);
      } else {
        // Cek juga dari cache lokal terisolasi per kelas + mapelId + semester + guruNip
        const nipSuffix = currentUser?.nip ? `_${currentUser.nip}` : '';
        const cacheKey = `ajar_absensi_${rombel.kelas}_${rombel.mapelId}_${autoSemester}${nipSuffix}`;
        let cached = localStorage.getItem(cacheKey);
        if (!cached) {
          cached = localStorage.getItem(`ajar_absensi_${rombel.kelas}_${rombel.mapelId}_${autoSemester}`);
        }
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            const saved: Record<number, string> = {};
            if (parsed.datesMap) {
              Object.entries(parsed.datesMap).forEach(([k, dateVal]) => {
                const num = parseInt(k, 10);
                if (!isNaN(num) && dateVal) {
                  saved[num] = String(dateVal);
                }
              });
              setSavedMeetings(saved);
            }
          } catch {}
        }
      }
    } catch {}
  };

  // 6. Muat Data Presensi Siswa Ketika Pertemuan Dipilih (Multi-Tier Robust Data Fetching)
  // Menjamin siswa SELALU muncul meskipun respon backend berbeda struktur atau hanya membawa absensiMap
  const loadAbsensiData = async (rombel: RombelItem, meet: number) => {
    setLoading(true);
    try {
      // Step A: Panggil endpoint getAbsensiData
      const res = await callGasApi('getAbsensiData', [
        token,
        rombel.kelas,
        rombel.mapelId,
        meet,
        autoSemester,
        currentUser?.nip || '',
      ]);

      // Step B: Ekstraksi calon siswa dari berbagai variasi respons GAS
      let rawStudents: any[] = [];
      if (res) {
        if (Array.isArray(res.siswa) && res.siswa.length > 0) rawStudents = res.siswa;
        else if (Array.isArray(res.data) && res.data.length > 0) rawStudents = res.data;
        else if (Array.isArray(res.daftarSiswa) && res.daftarSiswa.length > 0) rawStudents = res.daftarSiswa;
        else if (Array.isArray(res.listSiswa) && res.listSiswa.length > 0) rawStudents = res.listSiswa;
        else if (Array.isArray(res.students) && res.students.length > 0) rawStudents = res.students;
        else if (Array.isArray(res.dataSiswa) && res.dataSiswa.length > 0) rawStudents = res.dataSiswa;
        else if (Array.isArray(res) && res.length > 0) rawStudents = res;
      }

      // Step C: Fallback Tier 1 — Jika tidak ada siswa dalam respons getAbsensiData, ambil dari cache lokal
      if (rawStudents.length === 0) {
        const cached = localStorage.getItem('ajar_siswa_' + rombel.kelas);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              rawStudents = parsed;
            }
          } catch {}
        }
      }

      // Step D: Fallback Tier 2 — Jika masih kosong, tarik master siswa langsung dari Spreadsheet
      if (rawStudents.length === 0) {
        try {
          const masterRes = await callGasApi('getMasterSiswa', [token, rombel.kelas]);
          const rawMaster = masterRes?.data || masterRes?.siswa || (Array.isArray(masterRes) ? masterRes : []);
          if (Array.isArray(rawMaster) && rawMaster.length > 0) {
            rawStudents = rawMaster;
          }
        } catch (fetchErr) {
          console.warn('[Absensi] Fallback getMasterSiswa error:', fetchErr);
        }
      }

      // Step E: Normalisasi daftar siswa
      const normalizedStudents: SiswaItem[] = rawStudents.map(s => normalizeSiswaItem(s, rombel.kelas));
      setSiswaList(normalizedStudents);

      // Simpan ke cache lokal untuk ketersediaan instan di pertemuan lainnya
      if (normalizedStudents.length > 0) {
        localStorage.setItem('ajar_siswa_' + rombel.kelas, JSON.stringify(normalizedStudents));
        setClassStudentCounts(prev => ({ ...prev, [rombel.kelas]: normalizedStudents.length }));
      }

      // Step F: Petakan status absensi siswa
      const pKey = String(meet);
      const curMap: Record<string, 'H' | 'I' | 'S' | 'A'> = {};
      let hasSavedData = false;

      normalizedStudents.forEach(s => {
        const sId = s.SiswaID || s.siswaId || '';
        const nis = s.NIS || s.nis || '';
        const existing =
          (res?.absensiMap?.[sId]?.[pKey] as ('H' | 'I' | 'S' | 'A' | undefined)) ||
          (nis ? (res?.absensiMap?.[nis]?.[pKey] as ('H' | 'I' | 'S' | 'A' | undefined)) : undefined);

        if (existing) {
          hasSavedData = true;
          curMap[sId] = existing;
        } else {
          curMap[sId] = 'H';
        }
      });

      setAttendanceMap(curMap);

      if (res?.datesMap?.[pKey]) {
        setTanggal(res.datesMap[pKey]);
        hasSavedData = true;
        setSavedMeetings(prev => ({ ...prev, [meet]: res.datesMap[pKey] }));
      } else if (savedMeetings[meet]) {
        setTanggal(savedMeetings[meet]);
        hasSavedData = true;
      } else {
        // Jika belum pernah diisi: gunakan tanggal hari ini
        setTanggal(new Date().toISOString().split('T')[0]);
        hasSavedData = false;
      }

      // Kunci pertemuan otomatis jika data sudah pernah tersimpan sebelumnya (status Submitted)
      setIsLocked(hasSavedData);
      setIsDirty(!hasSavedData); // Siap simpan jika baru
    } catch {
      showToast('Gagal memuat data presensi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handler saat kartu rombel dibuka
  const handleOpenRombel = (rombel: RombelItem) => {
    setSelectedRombel(rombel);
    setPertemuan(null); // HARUS PILIH PERTEMUAN!
    setTanggal('');
    setSiswaList([]);
    setAttendanceMap({});
    setIsLocked(false);
    setIsDirty(false);
    setShowFullModal(true);
    loadRombelHistory(rombel);
  };

  // Handler saat kartu rombel diklik: validasi jika kelas belum ada siswanya
  const handleCardClick = (rombel: RombelItem) => {
    const studentCount = classStudentCounts[rombel.kelas];
    if (studentCount === 0) {
      setEmptyClassValidationTarget(rombel);
      return;
    }
    handleOpenRombel(rombel);
  };

  // Handler sinkronisasi langsung dari modal validasi kelas kosong
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
        showToast(`Data siswa kelas ${rombel.kelas} memang belum ada di spreadsheet. Silakan unggah data siswa.`, 'warning');
      }
    } catch {
      showToast('Gagal memeriksa data siswa dari spreadsheet.', 'error');
    } finally {
      setIsSyncingEmptyClass(false);
    }
  };

  // Handler saat nomor pertemuan dipilih dari dropdown
  const handleMeetingChange = (newMeeting: number | null) => {
    setPertemuan(newMeeting);
    if (!newMeeting) {
      setTanggal('');
      setSiswaList([]);
      setAttendanceMap({});
      setIsLocked(false);
      setIsDirty(false);
      return;
    }
    if (selectedRombel) {
      loadAbsensiData(selectedRombel, newMeeting);
    }
  };

  // Handler ubah status kehadiran siswa (H / I / S / A)
  const handleStatusChange = (siswaId: string, status: 'H' | 'I' | 'S' | 'A') => {
    if (isLocked) return;
    setIsDirty(true);
    setAttendanceMap(prev => ({
      ...prev,
      [siswaId]: status,
    }));
  };

  // Handler Set Semua Hadir
  const handleSetAllHadir = () => {
    if (isLocked) return;
    setIsDirty(true);
    const updated: Record<string, 'H' | 'I' | 'S' | 'A'> = {};
    siswaList.forEach(s => {
      const sId = s.SiswaID || s.siswaId || '';
      updated[sId] = 'H';
    });
    setAttendanceMap(updated);
    showToast('Seluruh siswa diset Hadir (H)', 'info');
  };

  // Live Counter Kehadiran
  const stats = useMemo(() => {
    let h = 0, i = 0, s = 0, a = 0;
    siswaList.forEach(item => {
      const id = item.SiswaID || item.siswaId || '';
      const st = attendanceMap[id] || 'H';
      if (st === 'H') h++;
      else if (st === 'I') i++;
      else if (st === 'S') s++;
      else if (st === 'A') a++;
    });
    return { h, i, s, a, total: siswaList.length };
  }, [siswaList, attendanceMap]);

  // Validasi tombol simpan aktif: hanya ketika pertemuan dipilih, ada siswa, ada perubahan, dan tidak terkunci
  const canSave = Boolean(pertemuan) && isDirty && !isLocked && !saving && siswaList.length > 0;

  // Handler Simpan Data Presensi dengan Isolasi Data Ketat
  const handleSave = async () => {
    if (!selectedRombel || !pertemuan || !canSave) return;
    setSaving(true);
    try {
      const payload = {
        mapelId: selectedRombel.mapelId,
        mapelNama: selectedRombel.mapelNama,
        kelas: selectedRombel.kelas,
        pertemuan: pertemuan,
        tanggal: tanggal,
        semester: autoSemester,
        tahunAjaran: tahunAjaran,
        guruNip: currentUser?.nip || '',
        userId: currentUser?.userId || '',
        records: attendanceMap,
      };

      const res = await callGasApi('saveAbsensiData', [token, payload]);
      if (res && res.success) {
        showToast(`Presensi pertemuan ke-${pertemuan} berhasil disimpan!`, 'success');
        setIsDirty(false);
        setIsLocked(true); // Kunci kembali ke status Submitted setelah disimpan
        setSavedMeetings(prev => ({ ...prev, [pertemuan]: tanggal }));

        // Simpan juga ke cache lokal per kelas + mapelId + semester + guruNip untuk isolasi 100%
        const nipSuffix = currentUser?.nip ? `_${currentUser.nip}` : '';
        const cacheKey = `ajar_absensi_${selectedRombel.kelas}_${selectedRombel.mapelId}_${autoSemester}${nipSuffix}`;
        let cachedData = { absensiMap: {} as any, datesMap: {} as any };
        try {
          const raw = localStorage.getItem(cacheKey);
          if (raw) cachedData = JSON.parse(raw);
        } catch {}
        const pKey = String(pertemuan);
        cachedData.datesMap[pKey] = tanggal;
        Object.entries(attendanceMap).forEach(([sId, st]) => {
          if (!cachedData.absensiMap[sId]) cachedData.absensiMap[sId] = {};
          cachedData.absensiMap[sId][pKey] = st;
        });
        localStorage.setItem(cacheKey, JSON.stringify(cachedData));
      } else {
        showToast(res?.message || 'Gagal menyimpan presensi.', 'error');
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

      {/* 3. DAFTAR KARTU KELAS & MATA PELAJARAN (Scrollable overscroll-contain, Spacer Bawah Melindungi dari Nav Bar) */}
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
                      <BookOpen className="w-5 h-5 stroke-[2.4]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-[#0D162B] tracking-tight truncate leading-none">
                          Kelas {rombel.kelas}
                        </h3>
                        {/* Tanda Ringkas: Belum Ada Siswa */}
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

                  {/* Sisi Kanan: Tombol Aksen Buka Presensi */}
                  <div className="flex items-center space-x-1.5 shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors">
                    {isClassEmpty ? (
                      <span className="text-[11px] font-medium text-amber-700 uppercase tracking-wider hidden sm:inline">
                        Perlu Data Siswa
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium uppercase tracking-wider hidden sm:inline">
                        Buka Presensi
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 stroke-[3]" />
                  </div>
                </div>
              );
            })}
            {/* Spacer fisik di akhir list agar kartu kelas terbawah 100% terlihat utuh dan tidak terpotong oleh bottom navigation bar */}
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
      {/* 4. FORMULIR FULL-SCREEN LEMBAR PRESENSI */}
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

            {/* FILTER PERTEMUAN & TANGGAL PRESENSI (MODERN NEUMORPHISM SOFT UI) */}
            <div className="px-3 sm:px-4 py-2.5 border-b border-[#d4deeb] bg-[#EEF2F6] shrink-0">
              {pertemuan === null ? (
                /* Mode 1: Pertemuan Belum Dipilih -> Dropdown Neumorphic Lebar Penuh (Tanggal Belum Muncul) */
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                    Pilih Pertemuan Ke
                  </label>
                  <NeuMeetingSelect
                    value={pertemuan}
                    onChange={handleMeetingChange}
                    savedMeetings={savedMeetings}
                    placeholder="-- Silakan Pilih Pertemuan (1 - 31) --"
                  />
                </div>
              ) : (
                /* Mode 2: Pertemuan Sudah Dipilih -> Grid 2 Kolom Sejajar Satu Baris (Mobile & Desktop) */
                <div className="grid grid-cols-2 gap-2 sm:gap-3 items-end">
                  {/* Filter Pertemuan 1 - 31 Bertema Neumorphism */}
                  <div className="min-w-0">
                    <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1 truncate">
                      Pertemuan Ke
                    </label>
                    <NeuMeetingSelect
                      value={pertemuan}
                      onChange={handleMeetingChange}
                      savedMeetings={savedMeetings}
                    />
                  </div>

                  {/* Tanggal Presensi: Tepat di Samping Pertemuan (Satu Baris) */}
                  <div className="min-w-0">
                    <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1 truncate">
                      Tanggal Presensi
                    </label>
                    <input
                      type="date"
                      value={tanggal}
                      disabled={isLocked}
                      onChange={e => {
                        setTanggal(e.target.value);
                        setIsDirty(true);
                      }}
                      className={`w-full h-11 rounded-2xl neu-pressed bg-[#E8EEF6] border border-white/80 px-2.5 sm:px-3 text-xs font-medium font-mono tabular-nums text-[#0D162B] outline-none transition-all ${
                        isLocked
                          ? 'cursor-not-allowed opacity-75'
                          : 'cursor-pointer hover:border-blue-300 focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20'
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* KONTEN UTAMA: STATE BELUM PILIH PERTEMUAN VS LEMBAR ABSENSI SISWA */}
            {/* ========================================================================= */}
            {pertemuan === null ? (
              /* A. STATE AWAL: TAMPILAN SILAKAN PILIH PERTEMUAN */
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center select-none space-y-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[28px] neu-inset bg-[#E8EEF6] text-blue-600 flex items-center justify-center shadow-inner">
                  <CalendarDays className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.2]" />
                </div>
                <div className="max-w-md space-y-1.5">
                  <h3 className="text-base sm:text-lg font-semibold text-[#0D162B] tracking-tight">
                    Silakan Pilih Pertemuan
                  </h3>
                  <p className="text-xs text-slate-500 font-normal leading-relaxed">
                    Pilih nomor pertemuan pada filter di atas untuk memuat tanggal presensi dan daftar kehadiran siswa kelas <span className="font-semibold text-[#0D162B]">{selectedRombel.kelas}</span> mata pelajaran <span className="font-medium text-blue-700">{selectedRombel.mapelNama}</span>.
                  </p>
                </div>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl neu-pressed bg-[#E8EEF6] text-[11px] font-medium text-slate-600">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                    Menunggu Pilihan Pertemuan
                  </span>
                </div>
              </div>
            ) : (
              /* B. LEMBAR PRESENSI SISWA SETELAH PERTEMUAN DIPILIH */
              <>
                {/* SUB-HEADER: TOMBOL HADIR SEMUA & LIVE COUNTER STATUS */}
                <div className="px-3 sm:px-4 py-2 border-b border-[#d4deeb] bg-[#EEF2F6] shrink-0 flex items-center justify-between gap-2 select-none">
                  <button
                    type="button"
                    onClick={handleSetAllHadir}
                    disabled={isLocked}
                    className={`py-1.5 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs ${
                      isLocked
                        ? 'neu-pressed text-slate-400 opacity-50 cursor-not-allowed'
                        : 'neu-btn bg-[#EEF2F6] text-emerald-700 hover:text-emerald-800 active:scale-95 cursor-pointer'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Hadir Semua</span>
                  </button>

                  {/* Counter H, I, S, A */}
                  <div className="flex items-center space-x-1.5 text-[11px] font-medium font-mono tabular-nums">
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800">
                      H: {stats.h}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-sky-100 text-sky-800">
                      I: {stats.i}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800">
                      S: {stats.s}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800">
                      A: {stats.a}
                    </span>
                  </div>
                </div>

                {/* TABEL LIST SISWA */}
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
                  {/* Header Kolom Tabel (Sticky / Tetap di Atas) */}
                  <div className="shrink-0 bg-[#E2E8F0]/90 border-b border-[#cbd5e1] text-[11px] font-medium text-slate-700 flex items-center px-3 py-2 select-none uppercase tracking-wider">
                    <div className="w-[10%] text-center">No.</div>
                    <div className="w-[52%] pl-1">Nama Siswa</div>
                    <div className="w-[38%] text-center">Kehadiran</div>
                  </div>

                  {/* Area Baris Siswa (Scrollable Vertikal) */}
                  <div
                    className={`flex-1 min-h-0 overflow-y-auto no-scrollbar transition-all duration-200 ${
                      isLocked ? 'filter blur-[1.5px] pointer-events-none select-none' : ''
                    }`}
                  >
                    {loading ? (
                      <div className="text-center py-12 text-blue-700 text-xs font-medium animate-pulse">
                        Memuat daftar kehadiran siswa...
                      </div>
                    ) : siswaList.length > 0 ? (
                      siswaList.map((s, idx) => {
                        const sId = s.SiswaID || s.siswaId || `s-${idx}`;
                        const nama = s.NamaSiswa || s.namaSiswa || s.nama || '-';
                        const curStatus = attendanceMap[sId] || 'H';

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

                            {/* Pilihan Kehadiran: H, I, S, A */}
                            <div className="w-[38%] flex items-center justify-center gap-1 shrink-0">
                              {(
                                [
                                  { key: 'H', label: 'H', activeCls: 'bg-emerald-600 text-white shadow-xs' },
                                  { key: 'I', label: 'I', activeCls: 'bg-sky-500 text-white shadow-xs' },
                                  { key: 'S', label: 'S', activeCls: 'bg-amber-500 text-slate-900 shadow-xs' },
                                  { key: 'A', label: 'A', activeCls: 'bg-rose-600 text-white shadow-xs' },
                                ] as const
                              ).map(st => {
                                const isSelected = curStatus === st.key;
                                return (
                                  <button
                                    key={st.key}
                                    type="button"
                                    disabled={isLocked}
                                    onClick={() => handleStatusChange(sId, st.key)}
                                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-medium flex items-center justify-center transition-all cursor-pointer ${
                                      isSelected
                                        ? `${st.activeCls} scale-105`
                                        : 'neu-flat text-slate-500 hover:text-slate-800'
                                    }`}
                                  >
                                    {st.label}
                                  </button>
                                );
                              })}
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

                  {/* OVERLAY STATUS SUBMITTED: Ditampilkan di Atas Tabel Saat Data Sudah Pernah Disimpan */}
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
                            Pertemuan {pertemuan} telah tersimpan{tanggal ? ` (${tanggal})` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsLocked(false);
                            setIsDirty(true);
                            showToast('Kunci presensi dibuka. Silakan sesuaikan kehadiran siswa lalu simpan kembali.', 'info');
                          }}
                          className="w-full sm:w-auto py-2 px-3.5 rounded-xl neu-btn bg-[#EEF2F6] text-blue-700 hover:text-blue-800 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shrink-0 border border-white/80 shadow-xs"
                          title="Buka Kunci untuk Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Edit Presensi</span>
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
                          Status: Submitted (Pertemuan {pertemuan})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsLocked(false);
                          setIsDirty(true);
                          showToast('Kunci presensi dibuka. Silakan sesuaikan kehadiran siswa lalu simpan kembali.', 'info');
                        }}
                        className="px-4 py-2 rounded-xl neu-btn bg-[#EEF2F6] text-blue-700 hover:text-blue-800 text-xs font-medium flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shrink-0 border border-white/80 shadow-xs"
                      >
                        <Edit2 className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Edit Presensi</span>
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
                          <span>Menyimpan Presensi...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Simpan Presensi Pertemuan ke-{pertemuan}</span>
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
      {/* 5. MODAL VALIDASI: KELAS BELUM ADA SISWANYA (TACTILE MODERN SOFT UI) */}
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
            {/* Header Dialog */}
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

            {/* Konten Keterangan */}
            <div className="p-3.5 rounded-2xl neu-inset bg-[#E8EEF6] border border-slate-200/60 text-xs text-slate-600 font-normal leading-relaxed space-y-1.5">
              <p>
                Kelas <span className="font-semibold text-[#0D162B]">{emptyClassValidationTarget.kelas}</span> belum memiliki daftar siswa di aplikasi ini.
              </p>
              <p className="text-[11px] text-slate-500">
                Sebelum memulai pengisian presensi dan penilaian, silakan unggah file data siswa (Excel/CSV) atau sinkronkan data yang sudah ada di spreadsheet.
              </p>
            </div>

            {/* Tombol Aksi */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              {/* Opsi 1: Upload / Kelola Siswa di Master Siswa */}
              <button
                type="button"
                onClick={() => {
                  const targetCls = emptyClassValidationTarget.kelas;
                  setEmptyClassValidationTarget(null);
                  if (onNavigate) {
                    onNavigate('master-siswa');
                  } else {
                    showToast(`Silakan menuju menu Master Siswa untuk mengunggah data kelas ${targetCls}`, 'info');
                  }
                }}
                className="w-full sm:flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_4px_10px_rgba(37,99,235,0.3)] border border-blue-500"
              >
                <Upload className="w-4 h-4 stroke-[2.5]" />
                <span>Upload Data Siswa</span>
              </button>

              {/* Opsi 2: Sinkronkan langsung dari Spreadsheet */}
              <button
                type="button"
                disabled={isSyncingEmptyClass}
                onClick={() => handleSyncEmptyClass(emptyClassValidationTarget)}
                className="w-full sm:w-auto py-2.5 px-3 rounded-xl neu-btn bg-[#EEF2F6] hover:bg-[#F2F6FA] text-blue-800 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all border border-white/80 shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${isSyncingEmptyClass ? 'animate-spin' : ''}`} />
                <span>{isSyncingEmptyClass ? 'Mengecek...' : 'Cek Spreadsheet'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
