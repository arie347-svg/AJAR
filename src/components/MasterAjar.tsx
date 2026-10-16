import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  Save,
  Lock,
  Unlock,
  Users,
  BookOpen,
  Layers,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  X,
  ChevronDown,
  GraduationCap,
  Calendar,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { MasterAjarData, MapelGroup, RefItem, User } from '../types';
import { callGasApi, DEFAULT_REFERENCES, getCachedReferences } from '../services/gasApi';
import { NeuMapelModal } from './NeuMapelModal';
import { NeuClassSelector } from './NeuClassSelector';
import { NeuWaliKelasModal } from './NeuWaliKelasModal';

interface MasterAjarProps {
  data: MasterAjarData;
  token: string;
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  currentUser?: User | null;
}

type EditConfirmationTarget =
  | { type: 'wali' }
  | { type: 'utama' }
  | { type: 'tambahan'; index: number }
  | { type: 'deleteTambahan'; index: number }
  | null;

export const MasterAjar: React.FC<MasterAjarProps> = ({
  data,
  token,
  onRefresh,
  showToast,
  currentUser,
}) => {
  // Snapshot data awal untuk mendeteksi perubahan
  const initialWaliKelas = data.waliKelas || 'Bukan Wali Kelas';
  const initialMapelUtamaId =
    data.mapelUtamaId || (data.mapelUtama?.mapelId ?? '');
  const initialUtamaKelases = useMemo(
    () => [...(data.mapelUtama?.kelases || [])].sort(),
    [data.mapelUtama?.kelases]
  );
  const initialMapelTambahan = useMemo(
    () =>
      (data.mapelTambahan || []).map(t => ({
        mapelId: t.mapelId || '',
        mapelNama: t.mapelNama || '',
        kelases: [...(t.kelases || [])].sort(),
        isUtama: false,
      })),
    [data.mapelTambahan]
  );

  // State Pengajaran
  const [waliKelas, setWaliKelas] = useState(initialWaliKelas);
  const [isWaliEditing, setIsWaliEditing] = useState(false);

  // Mapel Utama
  const [mapelUtamaId, setMapelUtamaId] = useState(initialMapelUtamaId);
  const [utamaKelases, setUtamaKelases] = useState<string[]>(
    data.mapelUtama?.kelases || []
  );
  const [isUtamaLocked, setIsUtamaLocked] = useState(Boolean(initialMapelUtamaId));

  // Mapel Tambahan
  const [mapelTambahan, setMapelTambahan] = useState<MapelGroup[]>(
    data.mapelTambahan || []
  );
  // Indeks paket tambahan yang sedang diedit (null jika semua terkunci)
  const [editingTambahanIdx, setEditingTambahanIdx] = useState<number | null>(null);

  // UI States
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState<EditConfirmationTarget>(null);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [activeTabMobile, setActiveTabMobile] = useState<'wali' | 'utama' | 'tambahan'>('utama');

  // Modal Popups Dropdown Neumorphic
  const [showWaliModal, setShowWaliModal] = useState(false);
  const [showMapelUtamaModal, setShowMapelUtamaModal] = useState(false);
  const [tambahanModalIdx, setTambahanModalIdx] = useState<number | null>(null);

  // Referensi kurikulum madrasah resmi dari spreadsheet (fallback ke cache/default)
  const listKelas: RefItem[] = useMemo(() => {
    if (data.listKelas && data.listKelas.length > 0) return data.listKelas;
    const cached = getCachedReferences();
    if (cached.Kelas && cached.Kelas.length > 0) return cached.Kelas;
    return DEFAULT_REFERENCES.Kelas || [];
  }, [data.listKelas]);

  const listMapel: RefItem[] = useMemo(() => {
    if (data.listMapel && data.listMapel.length > 0) return data.listMapel;
    const cached = getCachedReferences();
    if (cached.MataPelajaran && cached.MataPelajaran.length > 0) return cached.MataPelajaran;
    if (cached.Mapel && cached.Mapel.length > 0) return cached.Mapel;
    return DEFAULT_REFERENCES.MataPelajaran || [];
  }, [data.listMapel]);

  // Sinkronisasi data saat props data berubah dari server
  useEffect(() => {
    setWaliKelas(data.waliKelas || 'Bukan Wali Kelas');
    const uId = data.mapelUtamaId || (data.mapelUtama?.mapelId ?? '');
    setMapelUtamaId(uId);
    setUtamaKelases(data.mapelUtama?.kelases || []);
    setIsUtamaLocked(Boolean(uId));
    setMapelTambahan(data.mapelTambahan || []);
    setIsWaliEditing(false);
    setEditingTambahanIdx(null);
  }, [data]);

  // Kalkulasi deteksi perubahan riil (hasChanges)
  const hasChanges = useMemo(() => {
    if (waliKelas !== initialWaliKelas) return true;
    if (mapelUtamaId !== initialMapelUtamaId) return true;

    const currentUtamaSorted = [...utamaKelases].sort();
    if (
      currentUtamaSorted.length !== initialUtamaKelases.length ||
      currentUtamaSorted.some((k, i) => k !== initialUtamaKelases[i])
    ) {
      return true;
    }

    if (mapelTambahan.length !== initialMapelTambahan.length) return true;

    for (let i = 0; i < mapelTambahan.length; i++) {
      const cur = mapelTambahan[i];
      const init = initialMapelTambahan[i];
      if (!init) return true;
      if (cur.mapelId !== init.mapelId) return true;
      const curK = [...(cur.kelases || [])].sort();
      const initK = [...(init.kelases || [])].sort();
      if (
        curK.length !== initK.length ||
        curK.some((k, idx) => k !== initK[idx])
      ) {
        return true;
      }
    }

    return false;
  }, [
    waliKelas,
    initialWaliKelas,
    mapelUtamaId,
    initialMapelUtamaId,
    utamaKelases,
    initialUtamaKelases,
    mapelTambahan,
    initialMapelTambahan,
  ]);

  // Peringatan jika meninggalkan halaman dengan perubahan belum tersimpan
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  // Helper nama mapel
  const getMapelName = (id: string) => {
    if (!id) return '';
    const item = listMapel.find(m => m.code === id || m.id === id || m.name === id);
    return item?.name || id;
  };

  // Toggle kelas pada Mapel Utama
  const handleUtamaClassToggle = (kVal: string) => {
    setUtamaKelases(prev =>
      prev.includes(kVal) ? prev.filter(c => c !== kVal) : [...prev, kVal]
    );
  };

  // Kunci paket mapel utama
  const handleLockUtamaPackage = () => {
    if (!mapelUtamaId) {
      showToast('Pilih Mata Pelajaran Utama terlebih dahulu!', 'warning');
      return;
    }
    if (utamaKelases.length === 0) {
      showToast('Pilih minimal 1 kelas untuk paket Mata Pelajaran Utama!', 'warning');
      return;
    }
    setIsUtamaLocked(true);
  };

  // Tambah paket mapel tambahan baru
  const handleAddTambahanPackage = () => {
    const newIdx = mapelTambahan.length;
    setMapelTambahan(prev => [
      ...prev,
      {
        mapelId: '',
        mapelNama: '',
        kelases: [],
        isUtama: false,
      },
    ]);
    setEditingTambahanIdx(newIdx);
    setActiveTabMobile('tambahan');
  };

  // Hapus paket tambahan
  const executeRemoveTambahan = (index: number) => {
    setMapelTambahan(prev => prev.filter((_, i) => i !== index));
    if (editingTambahanIdx === index) {
      setEditingTambahanIdx(null);
    } else if (editingTambahanIdx !== null && editingTambahanIdx > index) {
      setEditingTambahanIdx(editingTambahanIdx - 1);
    }
    showToast('Paket mapel tambahan berhasil dihapus.', 'info');
  };

  // Ubah mapel tambahan
  const handleTambahanMapelChange = (index: number, mId: string) => {
    const mNama = getMapelName(mId);
    setMapelTambahan(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        mapelId: mId,
        mapelNama: mNama,
      };
      return copy;
    });
  };

  // Toggle kelas pada mapel tambahan
  const handleTambahanClassToggle = (index: number, kVal: string) => {
    setMapelTambahan(prev => {
      const copy = [...prev];
      const curClasses = copy[index].kelases || [];
      copy[index] = {
        ...copy[index],
        kelases: curClasses.includes(kVal)
          ? curClasses.filter(c => c !== kVal)
          : [...curClasses, kVal],
      };
      return copy;
    });
  };

  // Kunci paket mapel tambahan
  const handleLockTambahanPackage = (index: number) => {
    const item = mapelTambahan[index];
    if (!item?.mapelId) {
      showToast('Pilih Mata Pelajaran Tambahan terlebih dahulu!', 'warning');
      return;
    }
    if (!item.kelases || item.kelases.length === 0) {
      showToast('Pilih minimal 1 kelas untuk paket ini!', 'warning');
      return;
    }
    setEditingTambahanIdx(null);
  };

  // Eksekusi penyimpanan ke GAS API
  const handleConfirmSave = async () => {
    setShowSaveConfirmModal(false);

    if (!mapelUtamaId) {
      showToast('Pilih Mata Pelajaran Utama terlebih dahulu!', 'warning');
      return;
    }
    if (utamaKelases.length === 0) {
      showToast('Pilih minimal 1 kelas untuk Mata Pelajaran Utama!', 'warning');
      return;
    }

    // Pastikan tidak ada mapel tambahan kosong
    const validTambahan = mapelTambahan.filter(
      t => t.mapelId && t.kelases && t.kelases.length > 0
    );

    setSaving(true);
    try {
      const utamaItem: MapelGroup = {
        mapelId: mapelUtamaId,
        mapelNama: getMapelName(mapelUtamaId),
        kelases: utamaKelases,
        isUtama: true,
      };

      const payload = {
        mapelUtama: utamaItem,
        mapelTambahan: validTambahan,
      };

      const res = await callGasApi('saveMasterAjar', [
        token,
        waliKelas,
        payload,
        mapelUtamaId,
      ]);

      if (res && res.success) {
        showToast('Master Ajar berhasil disimpan!', 'success');
        setIsUtamaLocked(true);
        setIsWaliEditing(false);
        setEditingTambahanIdx(null);
        const ta = data.tahunAjaran || '2026/2027';
        if (currentUser?.userId) {
          localStorage.setItem(`master_ajar_configured_${currentUser.userId}_${ta}`, 'true');
        } else {
          localStorage.setItem(`master_ajar_configured_${ta}`, 'true');
        }
        onRefresh();
      } else {
        showToast(res?.message || 'Gagal menyimpan Master Ajar.', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Reset perubahan ke snapshot awal
  const handleResetChanges = () => {
    setWaliKelas(initialWaliKelas);
    setMapelUtamaId(initialMapelUtamaId);
    setUtamaKelases(initialUtamaKelases);
    setIsUtamaLocked(Boolean(initialMapelUtamaId));
    setMapelTambahan(initialMapelTambahan);
    setIsWaliEditing(false);
    setEditingTambahanIdx(null);
    showToast('Perubahan dibatalkan ke data awal.', 'info');
  };

  // Eksekusi konfirmasi Edit
  const handleProceedEdit = () => {
    if (!confirmModal) return;

    if (confirmModal.type === 'wali') {
      setIsWaliEditing(true);
      setShowWaliModal(true);
    } else if (confirmModal.type === 'utama') {
      setIsUtamaLocked(false);
    } else if (confirmModal.type === 'tambahan') {
      setEditingTambahanIdx(confirmModal.index);
    } else if (confirmModal.type === 'deleteTambahan') {
      executeRemoveTambahan(confirmModal.index);
    }
    setConfirmModal(null);
  };

  // Total kelas diajar
  const totalUniqueKelasCount = useMemo(() => {
    const setK = new Set<string>();
    utamaKelases.forEach(k => setK.add(k));
    mapelTambahan.forEach(t => t.kelases?.forEach(k => setK.add(k)));
    return setK.size;
  }, [utamaKelases, mapelTambahan]);

  return (
    <div className="flex flex-col h-full min-h-0 w-full select-none">
      {/* 1. TOP STATUS BANNER (Compact & Selaras Beranda) */}
      <div className="shrink-0 mb-2.5">
        <div className="neu-flat rounded-2xl p-2.5 sm:p-3 border border-white/90 grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
          {/* Sisi Kiri: Ringkasan Rombel */}
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="px-2.5 py-1 rounded-xl neu-pressed text-slate-700 text-[10px] sm:text-[11px] font-bold">
              {utamaKelases.length > 0 ? '1 Mapel Utama' : 'Belum Ada Mapel Utama'}
            </span>
            <span className="px-2.5 py-1 rounded-xl neu-pressed text-slate-700 text-[10px] sm:text-[11px] font-bold">
              {mapelTambahan.length} Mapel Tambahan
            </span>
          </div>

          {/* Posisi Tengah: Tahun Ajar dengan Ikon Selaras, Tanpa Pembungkus Hijau */}
          <div className="flex items-center justify-center gap-2 py-1 my-auto text-center justify-self-center">
            <CalendarDays className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-xs sm:text-sm font-extrabold text-[#0D162B] tracking-tight leading-normal">
              Tahun Ajar {data.tahunAjaran || '2026/2027'}
            </span>
          </div>

          {/* Sisi Kanan: Status Perubahan & Tombol Reset */}
          <div className="flex items-center justify-end gap-2 justify-self-end">
            {hasChanges && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[10px] sm:text-[11px] font-black animate-pulse">
                <Sparkles className="w-3 h-3 text-amber-600" />
                Ada Perubahan
              </span>
            )}

            {hasChanges && (
              <button
                type="button"
                onClick={handleResetChanges}
                className="px-2.5 py-1 rounded-xl neu-flat active:neu-pressed text-slate-600 hover:text-slate-900 border border-white/80 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                title="Batalkan semua perubahan ke awal"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden xs:inline">Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Sub-Navigation Tabs */}
        <div className="flex lg:hidden items-center p-1 mt-2 rounded-2xl neu-pressed bg-[#E8EEF6] gap-1">
          <button
            type="button"
            onClick={() => setActiveTabMobile('utama')}
            className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTabMobile === 'utama'
                ? 'neu-flat bg-[#EBF0F8] text-blue-700 border border-white/90 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            <span>Mapel Utama</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTabMobile('tambahan')}
            className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTabMobile === 'tambahan'
                ? 'neu-flat bg-[#EBF0F8] text-amber-700 border border-white/90 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            <span>Tambahan ({mapelTambahan.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTabMobile('wali')}
            className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTabMobile === 'wali'
                ? 'neu-flat bg-[#EBF0F8] text-emerald-700 border border-white/90 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            <span>Wali Kelas</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN 3-SECTION CONTAINER (Full screen fit with isolated vertical scroll) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-3 overflow-hidden">
        {/* ========================================================================= */}
        {/* SEKSI 1: TUGAS TAMBAHAN WALI KELAS */}
        {/* ========================================================================= */}
        <section
          className={`neu-raised-card bg-[#EAF0F9] rounded-2xl p-3 sm:p-4 border border-white/80 flex flex-col h-full min-h-0 ${
            activeTabMobile !== 'wali' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Area Scroll Mandiri */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-scroll pr-1 space-y-3">
            {!isWaliEditing ? (
              waliKelas === 'Bukan Wali Kelas' ? (
                <div className="neu-flat bg-[#EBF0F8] rounded-2xl p-4 text-center border border-white/90 flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl neu-pressed bg-[#E8EEF6] text-emerald-600 flex items-center justify-center shadow-inner">
                    <GraduationCap className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#0D162B]">
                      Bukan Wali Kelas
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmModal({ type: 'wali' })}
                    className="px-4 py-1.5 rounded-xl neu-flat active:neu-pressed text-emerald-700 hover:text-emerald-800 border border-emerald-200 text-xs font-black cursor-pointer shadow-xs"
                  >
                    edit
                  </button>
                </div>
              ) : (
                <div className="neu-flat bg-[#EBF0F8] rounded-2xl p-3.5 border border-white/90 space-y-3">
                  {/* Ikon Peran Aga Besar + Nama Wali Kelas */}
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center shrink-0 shadow-inner">
                      <GraduationCap className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-black text-[#0D162B] truncate">
                        Wali Kelas {waliKelas}
                      </h3>
                    </div>
                  </div>

                  {/* Di bawahnya: Ikon Kelas Aga Besar + List Kelas */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 p-2 rounded-xl neu-pressed bg-[#E8EEF6]">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center shrink-0 shadow-inner">
                        <Users className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <span className="text-xs font-black text-[#0D162B]">
                        Kelas {waliKelas}
                      </span>
                    </div>
                  </div>

                  {/* Tombol edit: cukup tulisan "edit" */}
                  <div className="pt-2 border-t border-[#d4deeb]/60 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setConfirmModal({ type: 'wali' })}
                      className="px-4 py-1.5 rounded-xl neu-flat active:neu-pressed text-emerald-700 hover:text-emerald-800 border border-emerald-200 text-xs font-black cursor-pointer shadow-xs"
                    >
                      edit
                    </button>
                  </div>
                </div>
              )
            ) : (
              /* FORMULIR EDIT WALI KELAS (CLEAN & RINGKAS) */
              <div className="neu-flat bg-[#EBF0F8] rounded-2xl p-3.5 border border-emerald-300 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-emerald-800">
                    Ubah Wali Kelas
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowWaliModal(true)}
                  className="w-full neu-pressed bg-[#E8EEF6] border border-white/70 rounded-2xl flex items-center justify-between p-3 text-left transition-all hover:bg-[#e4ebf5] active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center shrink-0 shadow-xs">
                      <GraduationCap className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <span className="truncate text-xs sm:text-sm font-extrabold text-[#0D162B]">
                      {waliKelas === 'Bukan Wali Kelas' ? 'Pilih Kelas Wali...' : `Wali Kelas ${waliKelas}`}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWaliKelas('Bukan Wali Kelas');
                    showToast('Status diatur: Bukan Wali Kelas', 'info');
                  }}
                  className={`w-full py-1.5 px-3 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    waliKelas === 'Bukan Wali Kelas'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-extrabold neu-pressed'
                      : 'neu-flat bg-[#EBF0F8] text-slate-600 hover:text-slate-800 border-white/80'
                  }`}
                >
                  <span>Bukan Wali Kelas</span>
                </button>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d4deeb]/60">
                  <button
                    type="button"
                    onClick={() => {
                      setWaliKelas(initialWaliKelas);
                      setIsWaliEditing(false);
                    }}
                    className="px-3 py-1.5 rounded-xl neu-flat active:neu-pressed text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsWaliEditing(false)}
                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-extrabold shadow-sm cursor-pointer"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SEKSI 2: MATA PELAJARAN UTAMA */}
        {/* ========================================================================= */}
        <section
          className={`neu-raised-card bg-[#EAF0F9] rounded-2xl p-3 sm:p-4 border border-white/80 flex flex-col h-full min-h-0 ${
            activeTabMobile !== 'utama' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Area Scroll Mandiri */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-scroll pr-1 space-y-3">
            {isUtamaLocked && mapelUtamaId ? (
              <div className="neu-flat bg-[#EBF0F8] rounded-2xl p-3.5 border border-white/90 space-y-3">
                {/* Icon Mapel Aga Besar + Nama Mapel */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center shrink-0 shadow-inner">
                    <BookOpen className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-black text-[#0D162B] truncate">
                      {getMapelName(mapelUtamaId)}
                    </h3>
                  </div>
                </div>

                {/* Di bawahnya: Icon Kelas Aga Besar + List Kelas */}
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2.5 p-2 rounded-xl neu-pressed bg-[#E8EEF6]">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center shrink-0 shadow-inner mt-0.5">
                      <GraduationCap className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div className="flex flex-wrap gap-1.5 flex-1 py-0.5">
                      {utamaKelases.length > 0 ? (
                        utamaKelases.map((k, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200/80 text-[11px] font-black shadow-xs"
                          >
                            {k}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Belum ada kelas</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tombol edit: cukup tulisan "edit" */}
                <div className="pt-2 border-t border-[#d4deeb]/60 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmModal({ type: 'utama' })}
                    className="px-4 py-1.5 rounded-xl neu-flat active:neu-pressed text-blue-700 hover:text-blue-800 border border-blue-200 text-xs font-black cursor-pointer shadow-xs"
                  >
                    edit
                  </button>
                </div>
              </div>
            ) : (
              /* FORMULIR EDIT 1 PAKET (CLEAN & RINGKAS) */
              <div className="neu-flat bg-[#EBF0F8] rounded-2xl p-3.5 border border-blue-300 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-blue-800">
                    Konfigurasi Mapel Utama
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMapelUtamaModal(true)}
                  className="w-full neu-pressed bg-[#E8EEF6] border border-white/70 rounded-2xl flex items-center justify-between p-3 text-left transition-all hover:bg-[#e4ebf5] active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center shrink-0 shadow-xs">
                      <BookOpen className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <span
                      className={`truncate text-xs sm:text-sm font-extrabold block ${
                        mapelUtamaId ? 'text-[#0D162B]' : 'text-slate-400 font-bold'
                      }`}
                    >
                      {mapelUtamaId ? getMapelName(mapelUtamaId) : 'Pilih Mata Pelajaran Utama...'}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                <NeuClassSelector
                  listKelas={listKelas}
                  selectedKelases={utamaKelases}
                  onToggleClass={handleUtamaClassToggle}
                  accentColor="blue"
                />

                <div className="flex items-center justify-between pt-2 border-t border-[#d4deeb]/60">
                  {initialMapelUtamaId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMapelUtamaId(initialMapelUtamaId);
                        setUtamaKelases(initialUtamaKelases);
                        setIsUtamaLocked(true);
                      }}
                      className="px-3 py-1.5 rounded-xl neu-flat active:neu-pressed text-slate-600 text-xs font-bold cursor-pointer"
                    >
                      Batal
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400">Wajib diisi</span>
                  )}

                  <button
                    type="button"
                    onClick={handleLockUtamaPackage}
                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-extrabold shadow-sm cursor-pointer"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SEKSI 3: MATA PELAJARAN TAMBAHAN */}
        {/* ========================================================================= */}
        <section
          className={`neu-raised-card bg-[#EAF0F9] rounded-2xl p-3 sm:p-4 border border-white/80 flex flex-col h-full min-h-0 ${
            activeTabMobile !== 'tambahan' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Area Scroll Mandiri */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-scroll pr-1 space-y-3">
            {mapelTambahan.length === 0 ? (
              <div className="neu-flat bg-[#EBF0F8] rounded-2xl p-5 text-center border border-white/90 flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-2xl neu-pressed bg-[#E8EEF6] text-amber-600 flex items-center justify-center shadow-inner">
                  <Layers className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-[#0D162B]">
                    Tidak Ada Mata Pelajaran Tambahan
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handleAddTambahanPackage}
                  className="px-4 py-2 rounded-xl neu-flat active:neu-pressed text-amber-700 hover:text-amber-800 border border-amber-200 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Tambah Mapel Tambahan</span>
                </button>
              </div>
            ) : (
              mapelTambahan.map((tambahan, idx) => {
                const isEditing = editingTambahanIdx === idx;
                const mNama = tambahan.mapelNama || getMapelName(tambahan.mapelId);

                return (
                  <div
                    key={idx}
                    className={`neu-flat bg-[#EBF0F8] rounded-2xl p-3.5 border transition-all ${
                      isEditing
                        ? 'border-amber-300 shadow-sm space-y-3'
                        : 'border-white/90 space-y-3'
                    }`}
                  >
                    {!isEditing ? (
                      /* LOCKED PACKAGE VIEW */
                      <>
                        {/* Icon Mapel Aga Besar + Nama Mapel */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center shrink-0 shadow-inner">
                              <Layers className="w-6 h-6 stroke-[2.5]" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm sm:text-base font-black text-[#0D162B] truncate">
                                {mNama || 'Belum Memilih Mapel'}
                              </h3>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setConfirmModal({ type: 'deleteTambahan', index: idx })
                            }
                            className="p-1.5 rounded-xl neu-flat active:neu-pressed text-rose-600 hover:text-rose-700 border border-rose-200/60 cursor-pointer shadow-xs"
                            title="Hapus paket"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Di bawahnya: Icon Kelas Aga Besar + List Kelas */}
                        <div className="space-y-1.5">
                          <div className="flex items-start gap-2.5 p-2 rounded-xl neu-pressed bg-[#E8EEF6]">
                            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center shrink-0 shadow-inner mt-0.5">
                              <GraduationCap className="w-4 h-4 stroke-[2.5]" />
                            </div>
                            <div className="flex flex-wrap gap-1.5 flex-1 py-0.5">
                              {tambahan.kelases && tambahan.kelases.length > 0 ? (
                                tambahan.kelases.map((k, kIdx) => (
                                  <span
                                    key={kIdx}
                                    className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/80 text-[11px] font-black shadow-xs"
                                  >
                                    {k}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Belum ada kelas</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Tombol edit: cukup tulisan "edit" */}
                        <div className="pt-2 border-t border-[#d4deeb]/60 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmModal({ type: 'tambahan', index: idx })
                            }
                            className="px-4 py-1.5 rounded-xl neu-flat active:neu-pressed text-amber-700 hover:text-amber-800 border border-amber-200 text-xs font-black cursor-pointer shadow-xs"
                          >
                            edit
                          </button>
                        </div>
                      </>
                    ) : (
                      /* EDITING PACKAGE VIEW */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-amber-800">
                            Konfigurasi Mapel Tambahan
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmModal({ type: 'deleteTambahan', index: idx })
                            }
                            className="p-1 rounded-lg text-rose-500 hover:text-rose-700 text-xs cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setTambahanModalIdx(idx)}
                          className="w-full neu-pressed bg-[#E8EEF6] border border-white/70 rounded-2xl flex items-center justify-between p-3 text-left transition-all hover:bg-[#e4ebf5] active:scale-[0.99] cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center shrink-0 shadow-xs">
                              <Layers className="w-4 h-4 stroke-[2.5]" />
                            </div>
                            <span
                              className={`truncate text-xs sm:text-sm font-extrabold block ${
                                tambahan.mapelId ? 'text-[#0D162B]' : 'text-slate-400 font-bold'
                              }`}
                            >
                              {tambahan.mapelNama || (tambahan.mapelId ? getMapelName(tambahan.mapelId) : 'Pilih Mata Pelajaran Tambahan...')}
                            </span>
                          </div>
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        </button>

                        <NeuClassSelector
                          listKelas={listKelas}
                          selectedKelases={tambahan.kelases || []}
                          onToggleClass={kVal => handleTambahanClassToggle(idx, kVal)}
                          accentColor="amber"
                        />

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d4deeb]/60">
                          <button
                            type="button"
                            onClick={() => handleLockTambahanPackage(idx)}
                            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-xs font-extrabold shadow-sm cursor-pointer"
                          >
                            Simpan
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Tombol Aksi Tambahan */}
            {mapelTambahan.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <button
                  type="button"
                  onClick={handleAddTambahanPackage}
                  className="w-full py-2.5 rounded-xl neu-flat active:neu-pressed text-amber-700 hover:text-amber-800 border border-amber-200/80 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Tambah Mapel Tambahan</span>
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 3. MODERN FLEXIBLE DOCK / SAVE BAR */}
      <div className="shrink-0 pt-2.5 pb-1">
        <div className="neu-flat rounded-2xl p-2.5 sm:p-3 border border-white/90 flex items-center justify-between gap-3 shadow-md">
          <div className="min-w-0 hidden sm:block">
            <p className="text-xs font-black text-[#0D162B]">
              {hasChanges
                ? 'Perubahan Terdeteksi'
                : 'Data Master Ajar Tersimpan'}
            </p>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              {hasChanges
                ? 'Klik Simpan untuk memperbarui konfigurasi penugasan ke server'
                : 'Semua konfigurasi pengajaran telah sinkron dengan server'}
            </p>
          </div>

          <div className="flex-1 sm:flex-initial sm:min-w-[280px]">
            <button
              type="button"
              onClick={() => {
                if (hasChanges && !saving) {
                  setShowSaveConfirmModal(true);
                }
              }}
              disabled={!hasChanges || saving}
              className={`w-full py-2.5 sm:py-3 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                hasChanges && !saving
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-lg shadow-blue-500/35 hover:shadow-blue-500/50 active:scale-98 cursor-pointer border border-blue-400/30'
                  : 'neu-flat bg-[#EBF0F8] text-slate-400 border border-white/80 cursor-not-allowed opacity-60'
              }`}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Menyimpan ke Server...</span>
                </>
              ) : hasChanges ? (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan Master Ajar</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Data Sudah Terkunci &amp; Tersimpan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL VALIDASI EDIT NEUMORPHIC */}
      {/* ========================================================================= */}
      {confirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="neu-raised-card bg-[#EBF0F8] max-w-[340px] w-full p-5 rounded-[28px] text-center relative border border-white/90 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div
              className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3 shadow-inner ${
                confirmModal.type === 'deleteTambahan'
                  ? 'bg-rose-50 text-rose-500'
                  : confirmModal.type === 'wali'
                  ? 'bg-emerald-50 text-emerald-600'
                  : confirmModal.type === 'utama'
                  ? 'bg-blue-50 text-blue-600'
                  : 'bg-amber-50 text-amber-600'
              }`}
            >
              {confirmModal.type === 'deleteTambahan' ? (
                <Trash2 className="w-6 h-6 stroke-[2.5]" />
              ) : (
                <Edit3 className="w-6 h-6 stroke-[2.5]" />
              )}
            </div>

            <h3 className="text-base font-extrabold text-[#0D162B]">
              {confirmModal.type === 'deleteTambahan'
                ? 'Hapus Mata Pelajaran Tambahan?'
                : confirmModal.type === 'wali'
                ? 'Edit Tugas Wali Kelas?'
                : confirmModal.type === 'utama'
                ? 'Edit Mapel Utama?'
                : 'Edit Mata Pelajaran Tambahan?'}
            </h3>

            <p className="text-xs text-slate-500 mt-1 mb-5 font-medium leading-relaxed">
              {confirmModal.type === 'deleteTambahan'
                ? 'Mata pelajaran tambahan ini akan dihapus dari konfigurasi mengajar Anda.'
                : 'Mata pelajaran dan kelas akan terbuka untuk diedit. Pastikan menyimpan perubahan setelah selesai.'}
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="w-full py-2.5 rounded-xl neu-flat active:neu-pressed text-slate-700 font-bold text-xs cursor-pointer transition-all active:scale-95"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleProceedEdit}
                className={`w-full py-2.5 rounded-xl text-white font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer ${
                  confirmModal.type === 'deleteTambahan'
                    ? 'bg-gradient-to-r from-rose-500 to-rose-600 shadow-rose-500/30'
                    : confirmModal.type === 'wali'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-500/30'
                    : confirmModal.type === 'utama'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/30'
                    : 'bg-gradient-to-r from-amber-600 to-orange-600 shadow-amber-500/30'
                }`}
              >
                {confirmModal.type === 'deleteTambahan' ? 'Ya, Hapus' : 'Lanjutkan Edit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL VALIDASI SIMPAN NEUMORPHIC */}
      {/* ========================================================================= */}
      {showSaveConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowSaveConfirmModal(false)}
        >
          <div
            className="neu-raised-card bg-[#EBF0F8] max-w-[360px] w-full p-5 rounded-[28px] text-center relative border border-white/90 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 shadow-inner">
              <Save className="w-6 h-6 stroke-[2.5]" />
            </div>

            <h3 className="text-base font-extrabold text-[#0D162B]">
              Simpan Master Ajar
            </h3>

            <p className="text-xs text-slate-500 mt-1 mb-3.5 font-medium leading-relaxed">
              Konfigurasi mengajar berikut akan disinkronkan ke database server Google Sheets:
            </p>

            {/* Ringkasan Perubahan Neumorphic */}
            <div className="neu-pressed bg-[#E8EEF6] p-3 rounded-2xl text-left space-y-2 mb-4 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">Wali Kelas:</span>
                <span className="font-extrabold text-[#0D162B]">{waliKelas}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">Mapel Utama:</span>
                <span className="font-extrabold text-blue-700 truncate max-w-[170px]">
                  {getMapelName(mapelUtamaId) || '-'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">Kelas Utama:</span>
                <span className="font-extrabold text-[#0D162B]">
                  {utamaKelases.length} Rombel
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">Mapel Tambahan:</span>
                <span className="font-extrabold text-amber-700">
                  {mapelTambahan.length} Paket
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowSaveConfirmModal(false)}
                className="w-full py-2.5 rounded-xl neu-flat active:neu-pressed text-slate-700 font-bold text-xs cursor-pointer transition-all active:scale-95"
              >
                Periksa Kembali
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/30 active:scale-95 transition-all cursor-pointer"
              >
                Ya, Simpan Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL NEUMORPHIC PEMILIHAN WALI KELAS */}
      {/* ========================================================================= */}
      <NeuWaliKelasModal
        isOpen={showWaliModal}
        onClose={() => setShowWaliModal(false)}
        listKelas={listKelas}
        currentWaliKelas={waliKelas}
        onSelectWaliKelas={selectedVal => {
          setWaliKelas(selectedVal);
          showToast(
            selectedVal === 'Bukan Wali Kelas'
              ? 'Status diatur: Bukan Wali Kelas'
              : `Penugasan wali kelas dipilih: ${selectedVal}`,
            'info'
          );
        }}
      />

      {/* ========================================================================= */}
      {/* 7. MODAL NEUMORPHIC PEMILIHAN MAPEL UTAMA */}
      {/* ========================================================================= */}
      <NeuMapelModal
        isOpen={showMapelUtamaModal}
        onClose={() => setShowMapelUtamaModal(false)}
        title="Pilih Mata Pelajaran Utama"
        subtitle="Mata pelajaran pokok yang Anda ampu di madrasah"
        accentColor="blue"
        listMapel={listMapel}
        selectedMapelId={mapelUtamaId}
        onSelect={(mId, mName) => {
          setMapelUtamaId(mId);
          showToast(`Mapel Utama dipilih: ${mName}`, 'info');
        }}
      />

      {/* ========================================================================= */}
      {/* 8. MODAL NEUMORPHIC PEMILIHAN MAPEL TAMBAHAN */}
      {/* ========================================================================= */}
      {tambahanModalIdx !== null && (
        <NeuMapelModal
          isOpen={tambahanModalIdx !== null}
          onClose={() => setTambahanModalIdx(null)}
          title="Pilih Mata Pelajaran Tambahan"
          subtitle="Mata pelajaran muatan lokal atau penugasan tambahan"
          accentColor="amber"
          listMapel={listMapel}
          selectedMapelId={mapelTambahan[tambahanModalIdx]?.mapelId || ''}
          onSelect={(mId, mName) => {
            handleTambahanMapelChange(tambahanModalIdx, mId);
            showToast(`Mapel Tambahan dipilih: ${mName}`, 'info');
          }}
        />
      )}
    </div>
  );
};
