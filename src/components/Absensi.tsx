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
  ChevronRight,
  ChevronDown,
  CalendarDays,
} from 'lucide-react';
import { PengajaranItem, SiswaItem, User } from '../types';
import { callGasApi } from '../services/gasApi';

interface AbsensiProps {
  token: string;
  pengajaranList: PengajaranItem[];
  currentUser?: User | null;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
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

// Komponen Dropdown List Pertemuan Bertema Modern Soft UI / Neumorphism
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
      {/* Trigger Button Bertema Neumorphism */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full h-11 rounded-2xl neu-pressed bg-[#E8EEF6] border flex items-center justify-between px-2.5 sm:px-3.5 transition-all cursor-pointer active:scale-[0.99] ${
          isOpen
            ? 'border-blue-500/80 ring-2 ring-blue-500/20'
            : 'border-white/80 hover:border-blue-300'
        }`}
      >
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 pr-1">
          <CalendarDays className="w-4 h-4 text-blue-600 shrink-0" />
          <span
            className={`truncate text-xs sm:text-sm font-black ${
              value ? 'text-[#0D162B]' : 'text-slate-400 font-bold'
            }`}
          >
            {value ? `Pertemuan ${value}` : placeholder}
          </span>
          {value && activeSavedDate && (
            <span className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black shrink-0">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
              Tersimpan
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {/* Popover Menu Neumorphic */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#EEF2F6] border border-white/90 rounded-2xl shadow-[10px_16px_36px_rgba(153,174,206,0.48),-8px_-8px_24px_rgba(255,255,255,0.95)] p-1.5 max-h-60 sm:max-h-72 overflow-y-auto no-scrollbar overscroll-contain animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2 py-1 mb-1 border-b border-[#cbd5e1]/60 flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-wider">
            <span>Daftar Pertemuan</span>
            <span className="text-blue-700 font-bold">1 - 31</span>
          </div>
          <div className="space-y-1">
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
                  className={`w-full flex items-center justify-between px-2.5 sm:px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.01]'
                      : 'text-slate-700 hover:bg-white/80 hover:text-blue-700 active:scale-[0.98]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <span className="w-5 text-center tabular-nums text-[10px] opacity-75">
                      #{p}
                    </span>
                    <span className="truncate">Pertemuan {p}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isSaved && (
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          isSelected
                            ? 'bg-white/25 text-white'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                        <span>Tersimpan{savedDate ? ` • ${savedDate}` : ''}</span>
                      </span>
                    )}
                    {isSelected && !isSaved && (
                      <span className="text-[10px] font-bold text-white/90">Aktif</span>
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

  // 2. Ekstraksi Daftar Rombel Mengajar (Mapel + Kelas) dari Master Ajar
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

    return Array.from(map.values()).sort((a, b) => a.kelas.localeCompare(b.kelas));
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

  // Filter daftar rombel sesuai tingkat yang aktif
  const displayedRombels = useMemo(() => {
    if (!activeLevel) return rombelList;
    return rombelList.filter(r => r.level === activeLevel);
  }, [rombelList, activeLevel]);

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

  // 6. Muat Data Presensi Siswa Ketika Pertemuan Dipilih
  const loadAbsensiData = async (rombel: RombelItem, meet: number) => {
    setLoading(true);
    try {
      const res = await callGasApi('getAbsensiData', [
        token,
        rombel.kelas,
        rombel.mapelId,
        meet,
        autoSemester,
        currentUser?.nip || '',
      ]);

      if (res && res.success) {
        const students: SiswaItem[] = res.siswa || res.data || [];
        setSiswaList(students);

        const pKey = String(meet);
        const curMap: Record<string, 'H' | 'I' | 'S' | 'A'> = {};
        let hasSavedData = false;

        students.forEach(s => {
          const sId = s.SiswaID || s.siswaId || '';
          const existing = res.absensiMap?.[sId]?.[pKey] as ('H' | 'I' | 'S' | 'A' | undefined);
          if (existing) {
            hasSavedData = true;
            curMap[sId] = existing;
          } else {
            curMap[sId] = 'H';
          }
        });

        setAttendanceMap(curMap);

        if (res.datesMap?.[pKey]) {
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
      }
    } catch {
      showToast('Gagal memuat data presensi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handler saat kartu rombel diklik di halaman awal
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
        <h2 className="text-sm sm:text-base font-black text-[#0D162B] tracking-tight uppercase">
          Semester {autoSemester}
        </h2>
        <p className="text-[10px] sm:text-[11px] font-extrabold text-blue-700 font-mono tracking-wider mt-0.5">
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
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    isActive
                      ? 'neu-flat bg-[#EEF2F6] text-blue-700 shadow-xs scale-[1.01]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Tingkat {lvl}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. DAFTAR KARTU KELAS & MATA PELAJARAN (Scrollable no-scrollbar, Padding Bawah Aman dari Nav Bar) */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2.5 pb-32 sm:pb-28 pr-0.5">
        {displayedRombels.length > 0 ? (
          displayedRombels.map(rombel => (
            <div
              key={rombel.id}
              onClick={() => handleOpenRombel(rombel)}
              className="w-full neu-raised-card bg-[#EEF2F6] hover:bg-[#F2F6FA] rounded-2xl p-3.5 sm:p-4 flex items-center justify-between border border-white/80 cursor-pointer active:scale-[0.99] transition-all shadow-xs group"
            >
              {/* Sisi Kiri: Ikon Kelas & Mata Pelajaran */}
              <div className="flex items-center space-x-3 min-w-0 pr-2">
                <div className="w-11 h-11 rounded-2xl neu-inset bg-[#E8EEF6] text-blue-600 flex items-center justify-center shrink-0 shadow-inner group-hover:text-blue-700 transition-colors">
                  <BookOpen className="w-5 h-5 stroke-[2.4]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-[#0D162B] tracking-tight truncate leading-none">
                    Kelas {rombel.kelas}
                  </h3>
                  <p className="text-[11px] text-blue-700 font-extrabold mt-1 truncate">
                    {rombel.mapelNama}
                  </p>
                </div>
              </div>

              {/* Sisi Kanan: Tombol Aksen Buka Presensi */}
              <div className="flex items-center space-x-1.5 shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors">
                <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">
                  Buka Presensi
                </span>
                <ChevronRight className="w-4 h-4 stroke-[3]" />
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 neu-raised-card bg-[#EEF2F6] rounded-3xl p-6 text-slate-500">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-extrabold text-slate-700">Tidak ada rombel mengajar di tingkat ini</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
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
                <h2 className="text-sm sm:text-base font-black text-[#0D162B] tracking-tight truncate">
                  Kelas {selectedRombel.kelas} • {selectedRombel.mapelNama}
                </h2>
                <p className="text-[10px] font-extrabold text-blue-700 font-mono mt-0.5">
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
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
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
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1 truncate">
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
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1 truncate">
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
                      className={`w-full h-11 rounded-2xl neu-pressed bg-[#E8EEF6] border border-white/80 px-2.5 sm:px-3 text-xs sm:text-sm font-black text-[#0D162B] outline-none transition-all ${
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
                  <h3 className="text-base sm:text-lg font-black text-[#0D162B] tracking-tight">
                    Silakan Pilih Pertemuan
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                    Pilih nomor pertemuan pada filter di atas untuk memuat tanggal presensi dan daftar kehadiran siswa kelas <span className="font-extrabold text-[#0D162B]">{selectedRombel.kelas}</span> mata pelajaran <span className="font-extrabold text-blue-700">{selectedRombel.mapelNama}</span>.
                  </p>
                </div>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl neu-pressed bg-[#E8EEF6] text-[11px] font-black text-slate-600">
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
                    className={`py-1.5 px-3 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs ${
                      isLocked
                        ? 'neu-pressed text-slate-400 opacity-50 cursor-not-allowed'
                        : 'neu-btn bg-[#EEF2F6] text-emerald-700 hover:text-emerald-800 active:scale-95 cursor-pointer'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Hadir Semua</span>
                  </button>

                  {/* Counter H, I, S, A */}
                  <div className="flex items-center space-x-1.5 text-[10px] sm:text-xs font-black">
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
                  <div className="shrink-0 bg-[#E2E8F0]/90 border-b border-[#cbd5e1] text-[11px] font-black text-slate-700 flex items-center px-3 py-2 select-none uppercase tracking-wider">
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
                      <div className="text-center py-12 text-blue-700 text-xs font-black animate-pulse">
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
                            <div className="w-[10%] text-center font-bold text-slate-500 tabular-nums text-[11px]">
                              {idx + 1}
                            </div>

                            {/* Nama Siswa */}
                            <div className="w-[52%] pl-1 font-black text-[#0D162B] truncate pr-1">
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
                                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-black flex items-center justify-center transition-all cursor-pointer ${
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
                      <div className="text-center py-10 text-slate-400 text-xs font-bold">
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
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black tracking-wide uppercase mb-1">
                            <Check className="w-3 h-3 stroke-[3]" />
                            Submitted
                          </div>
                          <p className="text-xs text-slate-600 font-bold">
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
                          className="w-full sm:w-auto py-2 px-3.5 rounded-xl neu-btn bg-[#EEF2F6] text-blue-700 hover:text-blue-800 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shrink-0 border border-white/80 shadow-xs"
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
                        <span className="text-xs font-black text-emerald-800 truncate">
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
                        className="px-4 py-2 rounded-xl neu-btn bg-[#EEF2F6] text-blue-700 hover:text-blue-800 text-xs font-black flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shrink-0 border border-white/80 shadow-xs"
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
                      className={`w-full h-12 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
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
    </div>
  );
};
