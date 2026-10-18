import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Layers,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Edit3,
  X,
  Plus,
  Trash2,
  ChevronDown,
  Save,
  Check,
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
  onVerified?: () => void;
}

export const MasterAjar: React.FC<MasterAjarProps> = ({
  data,
  token,
  onRefresh,
  showToast,
  currentUser,
  onVerified,
}) => {
  const currentTa = data.tahunAjaran || '2026/2027';

  // Snapshot data awal untuk mendeteksi perubahan / revert
  const initialWaliKelas = data.waliKelas || '';
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
  const initialConfirmedNoTambahan = useMemo(() => {
    return Boolean(
      data.mapelUtamaId ||
        (data.mapelTambahan && data.mapelTambahan.length > 0) ||
        (data.pengajaran && data.pengajaran.length > 0)
    );
  }, [data.mapelUtamaId, data.mapelTambahan, data.pengajaran]);

  const isInitiallyVerified = Boolean(
    (initialMapelUtamaId && initialUtamaKelases.length > 0 && initialWaliKelas) ||
      (currentUser?.userId &&
        localStorage.getItem(`master_ajar_configured_${currentUser.userId}_${currentTa}`) === 'true') ||
      localStorage.getItem(`master_ajar_configured_${currentTa}`) === 'true'
  );

  // State Pengajaran
  const [waliKelas, setWaliKelas] = useState(initialWaliKelas);
  const [mapelUtamaId, setMapelUtamaId] = useState(initialMapelUtamaId);
  const [utamaKelases, setUtamaKelases] = useState<string[]>(
    data.mapelUtama?.kelases || []
  );
  const [mapelTambahan, setMapelTambahan] = useState<MapelGroup[]>(
    data.mapelTambahan || []
  );
  const [hasConfirmedNoTambahan, setHasConfirmedNoTambahan] = useState(
    initialConfirmedNoTambahan
  );

  // Mode Verifikasi & Edit
  const [isVerified, setIsVerified] = useState(isInitiallyVerified);
  const [isEditing, setIsEditing] = useState(!isInitiallyVerified);
  const [saving, setSaving] = useState(false);

  // Floating Modals
  const [activeModal, setActiveModal] = useState<'utama' | 'tambahan' | 'wali' | null>(null);
  const [showMapelPicker, setShowMapelPicker] = useState<number | 'utama' | null>(null);

  // Referensi kurikulum madrasah
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

  // Buka kunci menu secara proaktif jika data dari server sudah lengkap
  useEffect(() => {
    if (isInitiallyVerified && onVerified) {
      onVerified();
    }
  }, [isInitiallyVerified, onVerified]);

  // Sinkronisasi saat data dari server diperbarui
  useEffect(() => {
    const uId = data.mapelUtamaId || (data.mapelUtama?.mapelId ?? '');
    const uKelases = data.mapelUtama?.kelases || [];
    const wKelas = data.waliKelas || '';
    setWaliKelas(wKelas);
    setMapelUtamaId(uId);
    setUtamaKelases(uKelases);
    setMapelTambahan(data.mapelTambahan || []);
    const confirmedNo = Boolean(
      uId ||
        (data.mapelTambahan && data.mapelTambahan.length > 0) ||
        (data.pengajaran && data.pengajaran.length > 0)
    );
    setHasConfirmedNoTambahan(confirmedNo);

    const verified = Boolean(
      (uId && uKelases.length > 0 && wKelas) ||
        (currentUser?.userId &&
          localStorage.getItem(`master_ajar_configured_${currentUser.userId}_${data.tahunAjaran || '2026/2027'}`) === 'true') ||
        localStorage.getItem(`master_ajar_configured_${data.tahunAjaran || '2026/2027'}`) === 'true'
    );
    setIsVerified(verified);
    setIsEditing(!verified);
    if (verified && onVerified) {
      onVerified();
    }
  }, [data, currentUser, onVerified]);

  // Helper nama mapel
  const getMapelName = (id: string) => {
    if (!id) return '';
    const item = listMapel.find(m => m.code === id || m.id === id || m.name === id);
    return item?.name || id;
  };

  // Status kelengkapan kartu
  const isUtamaComplete = Boolean(mapelUtamaId) && utamaKelases.length > 0;
  const isTambahanComplete =
    hasConfirmedNoTambahan ||
    (mapelTambahan.length > 0 &&
      mapelTambahan.every(t => Boolean(t.mapelId) && (t.kelases?.length || 0) > 0));
  const isWaliComplete = Boolean(waliKelas && waliKelas.trim() !== '');
  const isAllCardsComplete = isUtamaComplete && isTambahanComplete && isWaliComplete;

  // Toggle kelas pada Mapel Utama
  const handleUtamaClassToggle = (kVal: string) => {
    setUtamaKelases(prev =>
      prev.includes(kVal) ? prev.filter(c => c !== kVal) : [...prev, kVal]
    );
  };

  // Tambah paket mapel tambahan
  const handleAddTambahanPackage = () => {
    setMapelTambahan(prev => [
      ...prev,
      { mapelId: '', mapelNama: '', kelases: [], isUtama: false },
    ]);
    setHasConfirmedNoTambahan(false);
  };

  // Hapus paket tambahan
  const handleRemoveTambahan = (index: number) => {
    const updated = mapelTambahan.filter((_, i) => i !== index);
    setMapelTambahan(updated);
    if (updated.length === 0) {
      setHasConfirmedNoTambahan(true);
    }
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

  // Batal Edit (Revert ke snapshot)
  const handleCancelEdit = () => {
    setWaliKelas(initialWaliKelas);
    setMapelUtamaId(initialMapelUtamaId);
    setUtamaKelases(initialUtamaKelases);
    setMapelTambahan(initialMapelTambahan);
    setHasConfirmedNoTambahan(initialConfirmedNoTambahan);
    setIsEditing(false);
    showToast('Perubahan dibatalkan.', 'info');
  };

  // Verifikasi dan Simpan ke Server
  const handleVerify = async () => {
    if (!isAllCardsComplete) {
      showToast('Lengkapi ketiga kartu terlebih dahulu!', 'warning');
      return;
    }

    setSaving(true);
    try {
      const utamaItem: MapelGroup = {
        mapelId: mapelUtamaId,
        mapelNama: getMapelName(mapelUtamaId),
        kelases: utamaKelases,
        isUtama: true,
      };

      const validTambahan = mapelTambahan.filter(
        t => t.mapelId && t.kelases && t.kelases.length > 0
      );

      const payload = {
        mapelUtama: utamaItem,
        mapelTambahan: validTambahan,
      };

      // Simpan flag lokal secara instan agar menu langsung terbuka tanpa menunggu lambatnya server
      const ta = data.tahunAjaran || '2026/2027';
      if (currentUser?.userId) {
        localStorage.setItem(`master_ajar_configured_${currentUser.userId}_${ta}`, 'true');
      }
      if (currentUser?.nip) {
        localStorage.setItem(`master_ajar_configured_${currentUser.nip}_${ta}`, 'true');
      }
      if (currentUser?.username) {
        localStorage.setItem(`master_ajar_configured_${currentUser.username}_${ta}`, 'true');
      }
      localStorage.setItem(`master_ajar_configured_${ta}`, 'true');

      // Panggil callback pembuka kunci menu seketika
      if (onVerified) {
        onVerified();
      }

      const res = await callGasApi('saveMasterAjar', [
        token,
        waliKelas,
        payload,
        mapelUtamaId,
      ]);

      if (res && res.success) {
        showToast('Master Ajar berhasil diverifikasi! Seluruh menu telah terbuka.', 'success');
        setIsVerified(true);
        setIsEditing(false);
        onRefresh();
      } else {
        showToast(res?.message || 'Gagal memverifikasi Master Ajar ke server.', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Handle Card Click
  const handleCardClick = (type: 'utama' | 'tambahan' | 'wali') => {
    if (isVerified && !isEditing) {
      setIsEditing(true);
    }
    setActiveModal(type);
  };

  return (
    <div className="flex flex-col w-full max-w-xl sm:max-w-2xl mx-auto select-none space-y-3.5 pb-4">
      {/* 1. HEADER RINGKAS & BERSIH */}
      <div className="flex items-center justify-between pb-2 border-b border-[#d4deeb]/70">
        <div>
          <h2 className="text-base font-semibold text-[#1E2430] tracking-tight">Master Ajar</h2>
          <p className="text-[11px] text-[#5A6578]">Tahun Ajaran {currentTa}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono tabular-nums px-2.5 py-1 rounded-lg neu-pressed bg-[#E8EEF6] text-slate-700 font-medium">
            {[isUtamaComplete, isTambahanComplete, isWaliComplete].filter(Boolean).length}/3 Terisi
          </span>
        </div>
      </div>

      {/* 2. AREA 3 KARTU RINGKAS (INTERACTIVE SUMMARY CARDS) */}
      <div className="space-y-3">
        {/* KARTU 1: MAPEL UTAMA */}
        <div
          onClick={() => handleCardClick('utama')}
          className="neu-raised-card bg-[#EAF0F9] hover:bg-[#EEF4FB] rounded-2xl p-3.5 sm:p-4 border border-white/90 cursor-pointer active:scale-[0.99] transition-all shadow-sm"
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center justify-center">
                1
              </span>
              <span className="text-xs sm:text-sm font-semibold text-[#1E2430]">
                Mapel Utama &amp; Kelas
              </span>
            </div>
            {isUtamaComplete ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Terisi
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-medium">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                Wajib Diisi
              </span>
            )}
          </div>
          <div className="text-xs text-[#5A6578] pl-7">
            {isUtamaComplete ? (
              <p className="truncate font-medium text-[#1E2430]">
                {getMapelName(mapelUtamaId)}{' '}
                <span className="text-slate-500 font-normal">
                  ({utamaKelases.join(', ')})
                </span>
              </p>
            ) : (
              <p className="text-slate-400 italic">
                Belum dipilih. Klik kartu ini untuk memilih mata pelajaran dan rombel kelas.
              </p>
            )}
          </div>
        </div>

        {/* KARTU 2: MAPEL TAMBAHAN */}
        <div
          onClick={() => handleCardClick('tambahan')}
          className="neu-raised-card bg-[#EAF0F9] hover:bg-[#EEF4FB] rounded-2xl p-3.5 sm:p-4 border border-white/90 cursor-pointer active:scale-[0.99] transition-all shadow-sm"
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-700 text-[11px] font-bold flex items-center justify-center">
                2
              </span>
              <span className="text-xs sm:text-sm font-semibold text-[#1E2430]">
                Mapel Tambahan
              </span>
            </div>
            {isTambahanComplete ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {mapelTambahan.length > 0 ? 'Terisi' : 'Dikonfirmasi'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-medium">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                Wajib Diisi
              </span>
            )}
          </div>
          <div className="text-xs text-[#5A6578] pl-7">
            {mapelTambahan.length > 0 ? (
              <p className="truncate font-medium text-[#1E2430]">
                {mapelTambahan
                  .map(
                    t =>
                      `${t.mapelNama || getMapelName(t.mapelId)} (${(t.kelases || []).join(', ')})`
                  )
                  .join('; ')}
              </p>
            ) : hasConfirmedNoTambahan ? (
              <p className="font-medium text-[#1E2430]">
                Tidak Ada Mapel Tambahan{' '}
                <span className="text-slate-500 font-normal">
                  (Hanya 1 Mapel Utama)
                </span>
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-slate-400 italic">
                  Belum ditentukan. Klik kartu ini untuk menambah mapel, atau:
                </p>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setMapelTambahan([]);
                    setHasConfirmedNoTambahan(true);
                    showToast('Dikonfirmasi: Tidak ada mapel tambahan.', 'info');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-medium flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                >
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>Tidak Ada Tambahan</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* KARTU 3: WALI KELAS */}
        <div
          onClick={() => handleCardClick('wali')}
          className="neu-raised-card bg-[#EAF0F9] hover:bg-[#EEF4FB] rounded-2xl p-3.5 sm:p-4 border border-white/90 cursor-pointer active:scale-[0.99] transition-all shadow-sm"
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center justify-center">
                3
              </span>
              <span className="text-xs sm:text-sm font-semibold text-[#1E2430]">
                Tugas Wali Kelas
              </span>
            </div>
            {isWaliComplete ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Terisi
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-medium">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                Wajib Dipilih
              </span>
            )}
          </div>
          <div className="text-xs text-[#5A6578] pl-7">
            {waliKelas ? (
              <p className="font-medium text-[#1E2430]">
                {waliKelas === 'Bukan Wali Kelas'
                  ? 'Bukan Wali Kelas (Hanya Mengajar)'
                  : `Wali Kelas ${waliKelas}`}
              </p>
            ) : (
              <p className="text-slate-400 italic">
                Belum dipilih. Klik kartu ini untuk memilih rombel binaan atau status bukan wali kelas.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 3. SEKSI AKSI VERIFIKASI & STATUS (TERLIHAT JELAS & TIDAK TERTUTUP) */}
      <div className="neu-flat bg-[#EAF0F9] rounded-2xl p-3.5 sm:p-4 border border-white/90 shadow-sm space-y-2.5 mt-2">
        {/* Petunjuk status jika belum lengkap */}
        {!isAllCardsComplete && (
          <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50/80 border border-amber-200/90 p-2.5 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-[11px]">
              <p className="font-semibold text-amber-900">
                Lengkapi 3 kartu di atas untuk mengaktifkan tombol verifikasi:
              </p>
              <ul className="list-disc list-inside text-amber-800 font-medium space-y-0.5">
                {!isUtamaComplete && <li>Kartu 1: Pilih Mapel Utama &amp; Kelas</li>}
                {!isTambahanComplete && <li>Kartu 2: Konfirmasi / Pilih Mapel Tambahan</li>}
                {!isWaliComplete && <li>Kartu 3: Tentukan Penugasan Wali Kelas</li>}
              </ul>
            </div>
          </div>
        )}

        {/* Baris Tombol Aksi */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-0.5">
          <div className="text-xs text-[#5A6578]">
            <span className="font-medium text-[#1E2430]">Status Konfigurasi: </span>
            {isVerified && !isEditing ? (
              <span className="text-emerald-700 font-semibold">Terverifikasi &amp; Terkunci</span>
            ) : isAllCardsComplete ? (
              <span className="text-blue-700 font-semibold">Siap Diverifikasi</span>
            ) : (
              <span className="text-amber-700 font-semibold">Belum Lengkap</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Tombol Verifikasi / Verified */}
            {isVerified && !isEditing ? (
              <button
                type="button"
                disabled
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl neu-pressed bg-[#E8EEF6] text-emerald-700 font-semibold text-xs flex items-center justify-center gap-1.5 border border-emerald-300/80 cursor-default"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Verified</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleVerify}
                disabled={!isAllCardsComplete || saving}
                className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
                  isAllCardsComplete && !saving
                    ? 'neu-btn bg-blue-600 hover:bg-blue-700 text-white shadow-md cursor-pointer active:scale-95'
                    : 'neu-flat bg-[#E8EEF6] text-slate-400 border border-slate-300/80 cursor-not-allowed opacity-60'
                }`}
              >
                {saving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isEditing && isVerified
                        ? 'Simpan & Verifikasi'
                        : 'Verifikasi Master Ajar'}
                    </span>
                  </>
                )}
              </button>
            )}

            {/* Tombol Edit / Batal (X) */}
            {isVerified && (
              isEditing ? (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-3.5 py-2.5 rounded-xl neu-flat active:neu-pressed text-rose-600 hover:text-rose-700 border border-rose-200/90 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  title="Batalkan perubahan"
                >
                  <X className="w-4 h-4" />
                  <span>Batal</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-3.5 py-2.5 rounded-xl neu-flat active:neu-pressed text-slate-700 hover:text-[#1E2430] border border-white/90 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  title="Ubah konfigurasi"
                >
                  <Edit3 className="w-4 h-4 text-blue-600" />
                  <span>Edit</span>
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. FLOATING MODALS (TAMPILAN MENGAMBANG) */}
      {/* ========================================================================= */}

      {/* MODAL 1: MAPEL UTAMA & KELAS */}
      {activeModal === 'utama' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="neu-raised-card bg-[#EAF0F9] w-full max-w-lg max-h-[85vh] rounded-3xl p-4 sm:p-5 flex flex-col border border-white/95 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#d4deeb]/70 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1E2430]">
                    Mapel Utama &amp; Kelas
                  </h3>
                  <p className="text-[11px] text-[#5A6578]">
                    Tentukan 1 mata pelajaran utama dan rombel kelasnya
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-xl neu-flat active:neu-pressed text-slate-500 hover:text-[#1E2430] flex items-center justify-center border border-white/80 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Konten Modal */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 space-y-3.5">
              {/* Dropdown Mapel */}
              <div>
                <label className="text-[11px] font-medium text-[#5A6578] block mb-1">
                  Mata Pelajaran Utama
                </label>
                <button
                  type="button"
                  onClick={() => setShowMapelPicker('utama')}
                  className="w-full neu-pressed bg-[#E8EEF6] border border-white/70 rounded-2xl flex items-center justify-between p-3 text-left hover:bg-[#e4ebf5] active:scale-[0.99] cursor-pointer"
                >
                  <span
                    className={`truncate text-xs font-semibold ${
                      mapelUtamaId ? 'text-[#1E2430]' : 'text-slate-400'
                    }`}
                  >
                    {mapelUtamaId ? getMapelName(mapelUtamaId) : 'Pilih Mata Pelajaran Utama...'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              </div>

              {/* Class Selector */}
              <div>
                <label className="text-[11px] font-medium text-[#5A6578] block mb-1">
                  Pilih Rombongan Belajar / Kelas
                </label>
                <NeuClassSelector
                  listKelas={listKelas}
                  selectedKelases={utamaKelases}
                  onToggleClass={handleUtamaClassToggle}
                  accentColor="blue"
                />
              </div>
            </div>

            {/* Footer Modal */}
            <div className="pt-3 mt-3 border-t border-[#d4deeb]/70 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl neu-flat active:neu-pressed text-slate-600 text-xs font-medium cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!mapelUtamaId) {
                    showToast('Pilih Mata Pelajaran Utama terlebih dahulu!', 'warning');
                    return;
                  }
                  if (utamaKelases.length === 0) {
                    showToast('Pilih minimal 1 kelas untuk Mapel Utama!', 'warning');
                    return;
                  }
                  setActiveModal(null);
                  showToast('Mapel Utama tersimpan.', 'success');
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium shadow-sm cursor-pointer active:scale-95"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: MAPEL TAMBAHAN */}
      {activeModal === 'tambahan' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="neu-raised-card bg-[#EAF0F9] w-full max-w-lg max-h-[85vh] rounded-3xl p-4 sm:p-5 flex flex-col border border-white/95 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#d4deeb]/70 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
                  <Layers className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1E2430]">
                    Mapel Tambahan
                  </h3>
                  <p className="text-[11px] text-[#5A6578]">
                    Konfirmasi tidak ada tambahan atau tambahkan mapel lain
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-xl neu-flat active:neu-pressed text-slate-500 hover:text-[#1E2430] flex items-center justify-center border border-white/80 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Konten Modal */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 space-y-3.5">
              {/* Opsi Cepat: Tidak Ada Mapel Tambahan */}
              <button
                type="button"
                onClick={() => {
                  setMapelTambahan([]);
                  setHasConfirmedNoTambahan(true);
                  showToast('Dikonfirmasi: Tidak ada mata pelajaran tambahan.', 'info');
                }}
                className={`w-full p-3 rounded-2xl border text-xs font-medium flex items-center justify-between cursor-pointer transition-all ${
                  hasConfirmedNoTambahan && mapelTambahan.length === 0
                    ? 'neu-pressed bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'neu-flat bg-[#EBF0F8] text-slate-700 border-white/90 hover:bg-[#e4ebf5]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`w-4 h-4 ${
                      hasConfirmedNoTambahan && mapelTambahan.length === 0
                        ? 'text-emerald-600'
                        : 'text-slate-400'
                    }`}
                  />
                  <span>Saya Hanya Mengajar 1 Mapel Utama (Tidak Ada Tambahan)</span>
                </div>
              </button>

              {/* List Paket Tambahan */}
              {mapelTambahan.map((tambahan, idx) => (
                <div
                  key={idx}
                  className="neu-flat bg-[#EBF0F8] rounded-2xl p-3 border border-amber-200/80 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-800">
                      Paket Tambahan #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTambahan(idx)}
                      className="w-7 h-7 rounded-lg neu-flat active:neu-pressed text-rose-500 hover:text-rose-700 flex items-center justify-center border border-white/80 cursor-pointer"
                      title="Hapus paket"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Dropdown Mapel Tambahan */}
                  <button
                    type="button"
                    onClick={() => setShowMapelPicker(idx)}
                    className="w-full neu-pressed bg-[#E8EEF6] border border-white/70 rounded-xl flex items-center justify-between p-2.5 text-left hover:bg-[#e4ebf5] active:scale-[0.99] cursor-pointer"
                  >
                    <span
                      className={`truncate text-xs font-semibold ${
                        tambahan.mapelId ? 'text-[#1E2430]' : 'text-slate-400'
                      }`}
                    >
                      {tambahan.mapelNama ||
                        (tambahan.mapelId
                          ? getMapelName(tambahan.mapelId)
                          : 'Pilih Mata Pelajaran Tambahan...')}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>

                  {/* Class Selector Tambahan */}
                  <NeuClassSelector
                    listKelas={listKelas}
                    selectedKelases={tambahan.kelases || []}
                    onToggleClass={kVal => handleTambahanClassToggle(idx, kVal)}
                    accentColor="amber"
                  />
                </div>
              ))}

              {/* Tombol Tambah Paket */}
              <button
                type="button"
                onClick={handleAddTambahanPackage}
                className="w-full py-2.5 rounded-xl neu-flat active:neu-pressed text-amber-700 hover:text-amber-800 border border-amber-200/80 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Paket Mapel Tambahan</span>
              </button>
            </div>

            {/* Footer Modal */}
            <div className="pt-3 mt-3 border-t border-[#d4deeb]/70 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl neu-flat active:neu-pressed text-slate-600 text-xs font-medium cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (mapelTambahan.length > 0) {
                    const invalid = mapelTambahan.some(
                      t => !t.mapelId || !t.kelases || t.kelases.length === 0
                    );
                    if (invalid) {
                      showToast(
                        'Pilih mata pelajaran dan minimal 1 kelas untuk setiap paket tambahan!',
                        'warning'
                      );
                      return;
                    }
                  } else {
                    setHasConfirmedNoTambahan(true);
                  }
                  setActiveModal(null);
                  showToast('Mapel Tambahan tersimpan.', 'success');
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-medium shadow-sm cursor-pointer active:scale-95"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: WALI KELAS */}
      <NeuWaliKelasModal
        isOpen={activeModal === 'wali'}
        onClose={() => setActiveModal(null)}
        listKelas={listKelas}
        currentWaliKelas={waliKelas}
        onSelectWaliKelas={val => {
          setWaliKelas(val);
          setActiveModal(null);
          showToast(
            val === 'Bukan Wali Kelas'
              ? 'Status diatur: Bukan Wali Kelas'
              : `Wali Kelas diatur: ${val}`,
            'success'
          );
        }}
      />

      {/* PICKER MODAL KHUSUS MAPEL (Untuk Mapel Utama & Tambahan) */}
      <NeuMapelModal
        isOpen={showMapelPicker !== null}
        onClose={() => setShowMapelPicker(null)}
        title={
          showMapelPicker === 'utama'
            ? 'Pilih Mata Pelajaran Utama'
            : `Pilih Mata Pelajaran Tambahan #${(Number(showMapelPicker) || 0) + 1}`
        }
        listMapel={listMapel}
        selectedMapelId={
          showMapelPicker === 'utama'
            ? mapelUtamaId
            : mapelTambahan[Number(showMapelPicker)]?.mapelId || ''
        }
        accentColor={showMapelPicker === 'utama' ? 'blue' : 'amber'}
        onSelect={(mId, mNama) => {
          if (showMapelPicker === 'utama') {
            setMapelUtamaId(mId);
          } else if (typeof showMapelPicker === 'number') {
            setMapelTambahan(prev => {
              const copy = [...prev];
              copy[showMapelPicker] = {
                ...copy[showMapelPicker],
                mapelId: mId,
                mapelNama: mNama,
              };
              return copy;
            });
          }
          setShowMapelPicker(null);
        }}
      />
    </div>
  );
};
