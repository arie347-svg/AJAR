import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Edit3,
  X,
  Plus,
  Trash2,
  ChevronDown,
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
  // Wali kelas WAJIB dipilih secara eksplisit oleh guru, tidak otomatis "Bukan Wali Kelas"
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

  // State Pengajaran (Wali kelas kosong jika belum pernah memilih)
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

  // Buka kunci menu secara proaktif jika data sudah terverifikasi sebelumnya
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

  // Status kelengkapan kartu: Hanya icon centang / tanda seru
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

  // Batal Edit
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

      // Simpan flag lokal secara instan agar menu langsung terbuka tanpa delay
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

      // Buka kunci seluruh menu seketika
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
        showToast('Master Ajar berhasil diverifikasi.', 'success');
        setIsVerified(true);
        setIsEditing(false);
        onRefresh();
      } else {
        showToast(res?.message || 'Gagal memverifikasi Master Ajar.', 'error');
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
    <div className="flex flex-col w-full max-w-xl mx-auto select-none space-y-3 pb-6">
      {/* 1. HEADER MINIMALIS */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[#d4deeb]/70">
        <h2 className="text-xs sm:text-sm font-semibold text-[#1E2430]">Master Ajar</h2>
        <span className="text-[11px] font-mono text-slate-500">{currentTa}</span>
      </div>

      {/* 2. TEPAT 3 KARTU RINGKAS (HANYA ICON CENTANG / TANDA SERU) */}
      <div className="space-y-2.5">
        {/* KARTU 1: MAPEL UTAMA */}
        <div
          onClick={() => handleCardClick('utama')}
          className="neu-raised-card bg-[#EEF2F6] hover:bg-[#F3F7FC] rounded-2xl p-3.5 sm:p-4 border border-white/90 cursor-pointer active:scale-[0.99] transition-all flex items-center justify-between gap-3 shadow-xs"
        >
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-semibold text-[#1E2430]">Mapel Utama &amp; Kelas</h3>
            <p className="text-xs text-[#5A6578] truncate mt-0.5">
              {isUtamaComplete
                ? `${getMapelName(mapelUtamaId)} (${utamaKelases.join(', ')})`
                : 'Pilih mata pelajaran dan kelas'}
            </p>
          </div>
          {isUtamaComplete ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          )}
        </div>

        {/* KARTU 2: MAPEL TAMBAHAN */}
        <div
          onClick={() => handleCardClick('tambahan')}
          className="neu-raised-card bg-[#EEF2F6] hover:bg-[#F3F7FC] rounded-2xl p-3.5 sm:p-4 border border-white/90 cursor-pointer active:scale-[0.99] transition-all flex items-center justify-between gap-3 shadow-xs"
        >
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-semibold text-[#1E2430]">Mapel Tambahan</h3>
            <p className="text-xs text-[#5A6578] truncate mt-0.5">
              {mapelTambahan.length > 0
                ? mapelTambahan
                    .map(
                      t =>
                        `${t.mapelNama || getMapelName(t.mapelId)} (${(t.kelases || []).join(', ')})`
                    )
                    .join('; ')
                : hasConfirmedNoTambahan
                ? 'Tidak Ada Mapel Tambahan'
                : 'Pilih mapel tambahan atau konfirmasi tidak ada'}
            </p>
          </div>
          {isTambahanComplete ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          )}
        </div>

        {/* KARTU 3: WALI KELAS */}
        <div
          onClick={() => handleCardClick('wali')}
          className="neu-raised-card bg-[#EEF2F6] hover:bg-[#F3F7FC] rounded-2xl p-3.5 sm:p-4 border border-white/90 cursor-pointer active:scale-[0.99] transition-all flex items-center justify-between gap-3 shadow-xs"
        >
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-semibold text-[#1E2430]">Wali Kelas</h3>
            <p className="text-xs text-[#5A6578] truncate mt-0.5">
              {waliKelas
                ? waliKelas === 'Bukan Wali Kelas'
                  ? 'Bukan Wali Kelas'
                  : `Kelas ${waliKelas}`
                : 'Pilih rombel binaan atau bukan wali kelas'}
            </p>
          </div>
          {isWaliComplete ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          )}
        </div>
      </div>

      {/* 3. CUKUP TOMBOL VERIFIKASI (TANPA EMBEL-EMBEL LAIN) */}
      <div className="pt-2 flex items-center gap-2">
        {isVerified && !isEditing ? (
          <>
            <button
              type="button"
              disabled
              className="flex-1 py-3 px-4 rounded-2xl neu-pressed bg-[#E8EEF6] text-emerald-700 font-medium text-xs flex items-center justify-center gap-2 border border-emerald-300/60 cursor-default"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Verified</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="py-3 px-5 rounded-2xl neu-flat active:neu-pressed text-slate-700 hover:text-[#1E2430] border border-white/90 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <Edit3 className="w-4 h-4 text-blue-600" />
              <span>Edit</span>
            </button>
          </>
        ) : isEditing && isVerified ? (
          <>
            <button
              type="button"
              onClick={handleVerify}
              disabled={!isAllCardsComplete || saving}
              className={`flex-1 py-3 px-4 rounded-2xl font-medium text-xs flex items-center justify-center gap-2 transition-all ${
                isAllCardsComplete && !saving
                  ? 'neu-btn bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer active:scale-98'
                  : 'neu-flat bg-[#E8EEF6] text-slate-400 border border-white/80 cursor-not-allowed'
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
                  <span>Simpan &amp; Verifikasi</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="py-3 px-5 rounded-2xl neu-flat active:neu-pressed text-rose-600 hover:text-rose-700 border border-rose-200 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <X className="w-4 h-4" />
              <span>Batal</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleVerify}
            disabled={!isAllCardsComplete || saving}
            className={`w-full py-3 px-4 rounded-2xl font-medium text-xs flex items-center justify-center gap-2 transition-all ${
              isAllCardsComplete && !saving
                ? 'neu-btn bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer active:scale-98'
                : 'neu-flat bg-[#E8EEF6] text-slate-400 border border-white/80 cursor-not-allowed'
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
                <span>Verifikasi</span>
              </>
            )}
          </button>
        )}
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
            className="neu-raised-card bg-[#EEF2F6] w-full max-w-lg max-h-[85vh] rounded-3xl p-4 sm:p-5 flex flex-col border border-white/95 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#d4deeb]/70 shrink-0">
              <h3 className="text-xs sm:text-sm font-semibold text-[#1E2430]">
                Mapel Utama &amp; Kelas
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-xl neu-flat active:neu-pressed text-slate-500 hover:text-[#1E2430] flex items-center justify-center border border-white/80 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 space-y-3.5">
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
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm cursor-pointer active:scale-95"
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
            className="neu-raised-card bg-[#EEF2F6] w-full max-w-lg max-h-[85vh] rounded-3xl p-4 sm:p-5 flex flex-col border border-white/95 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#d4deeb]/70 shrink-0">
              <h3 className="text-xs sm:text-sm font-semibold text-[#1E2430]">
                Mapel Tambahan
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-xl neu-flat active:neu-pressed text-slate-500 hover:text-[#1E2430] flex items-center justify-center border border-white/80 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 space-y-3.5">
              <button
                type="button"
                onClick={() => {
                  setMapelTambahan([]);
                  setHasConfirmedNoTambahan(true);
                  showToast('Dikonfirmasi: Tidak ada mapel tambahan.', 'info');
                }}
                className={`w-full p-3 rounded-2xl border text-xs font-medium flex items-center justify-between cursor-pointer transition-all ${
                  hasConfirmedNoTambahan && mapelTambahan.length === 0
                    ? 'neu-pressed bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'neu-flat bg-[#E8EEF6] text-slate-700 border-white/90 hover:bg-[#e4ebf5]'
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
                  <span>Saya Hanya Mengajar 1 Mapel Utama</span>
                </div>
              </button>

              {mapelTambahan.map((tambahan, idx) => (
                <div
                  key={idx}
                  className="neu-flat bg-[#E8EEF6] rounded-2xl p-3 border border-amber-200/80 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-800">
                      Paket Tambahan #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTambahan(idx)}
                      className="w-7 h-7 rounded-lg neu-flat active:neu-pressed text-rose-500 hover:text-rose-700 flex items-center justify-center border border-white/80 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowMapelPicker(idx)}
                    className="w-full neu-pressed bg-[#EEF2F6] border border-white/70 rounded-xl flex items-center justify-between p-2.5 text-left hover:bg-[#e4ebf5] active:scale-[0.99] cursor-pointer"
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

                  <NeuClassSelector
                    listKelas={listKelas}
                    selectedKelases={tambahan.kelases || []}
                    onToggleClass={kVal => handleTambahanClassToggle(idx, kVal)}
                    accentColor="amber"
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddTambahanPackage}
                className="w-full py-2.5 rounded-xl neu-flat active:neu-pressed text-amber-700 hover:text-amber-800 border border-amber-200/80 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Paket Mapel Tambahan</span>
              </button>
            </div>

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
                        'Pilih mata pelajaran dan minimal 1 kelas untuk setiap paket!',
                        'warning'
                      );
                      return;
                    }
                  } else {
                    setHasConfirmedNoTambahan(true);
                  }
                  setActiveModal(null);
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium shadow-sm cursor-pointer active:scale-95"
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
        }}
      />

      {/* PICKER MODAL KHUSUS MAPEL */}
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
