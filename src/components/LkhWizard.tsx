import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  BookOpen,
  Briefcase,
  Calendar,
  CalendarDays,
  Clock,
  PlusCircle,
  Save,
  RefreshCw,
  Trash2,
  Copy,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  Check,
  Search,
} from 'lucide-react';
import { LkhRecord, PengajaranItem, User } from '../types';
import { callGasApi } from '../services/gasApi';

interface LkhWizardProps {
  token: string;
  currentUser: User | null;
  pengajaranList: PengajaranItem[];
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onNavigate?: (page: string) => void;
}

const DEFAULT_SUGGESTIONS_URAIAN = [
  'Melaksanakan kegiatan pembelajaran materi pokok sesuai modul ajar',
  'Memberikan bimbingan diskusi kelompok dan praktikum siswa',
  'Melaksanakan asesmen formatif harian dan pembahasan evaluasi soal',
  'Melakukan pendampingan remedi dan pengayaan materi peserta didik',
  'Mengikuti pembiasaan tadarus Al-Qur\'an dan sholat dhuha berjamaah',
  'Menghadiri rapat dinas koordinasi evaluasi kurikulum madrasah',
  'Melaksanakan piket harian dan pendampingan ketertiban madrasah',
];

const DEFAULT_SUGGESTIONS_HASIL = [
  'Siswa memahami materi dengan baik dan aktif berdiskusi (ketercapaian 88%)',
  'Seluruh peserta didik menyelesaikan tugas asesmen formatif tepat waktu',
  'Tercapai ketuntasan tujuan pembelajaran sesuai target modul ajar',
  'Peserta didik mampu menyelesaikan latihan soal dan studi kasus mandiri',
  'Kegiatan koordinasi berjalan lancar dan menghasilkan notulen tindak lanjut',
];

export const LkhWizard: React.FC<LkhWizardProps> = ({
  token,
  currentUser,
  pengajaranList,
  showToast,
  onNavigate,
}) => {
  // Tab Switcher: 'form' vs 'history'
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');

  // Form State
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [isNonKbm, setIsNonKbm] = useState(false);
  const [mapelId, setMapelId] = useState('');
  const [mapelNama, setMapelNama] = useState('');
  const [jamMulai, setJamMulai] = useState<number | string>(1);
  const [jamSelesai, setJamSelesai] = useState<number | string>(2);
  const [kelas, setKelas] = useState('');
  const [uraian, setUraian] = useState('');
  const [hasil, setHasil] = useState('');

  // History State
  const [historyRecords, setHistoryRecords] = useState<LkhRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Perhitungan Semester & Tahun Ajaran
  const currentMonth = new Date().getMonth() + 1;
  const autoSemester: 'Ganjil' | 'Genap' =
    currentMonth >= 7 && currentMonth <= 12 ? 'Ganjil' : 'Genap';
  const tahunAjaran = '2026/2027';

  // Daftar Mapel & Kelas Guru dari pengajaranList
  const distinctMapels = useMemo(() => {
    const map = new Map<string, string>();
    pengajaranList.forEach(p => {
      if (p.mapelId) {
        map.set(p.mapelId, p.mapelNama || p.mapelId);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [pengajaranList]);

  const availableClassesForMapel = useMemo(() => {
    return pengajaranList
      .filter(p => (mapelId ? p.mapelId === mapelId : true))
      .map(p => p.kelas || '')
      .filter(Boolean);
  }, [pengajaranList, mapelId]);

  const distinctClasses = useMemo(() => {
    return Array.from(new Set(availableClassesForMapel));
  }, [availableClassesForMapel]);

  // Inisialisasi Mapel otomatis jika belum terpilih
  useEffect(() => {
    if (distinctMapels.length > 0 && !mapelId) {
      setMapelId(distinctMapels[0].id);
      setMapelNama(distinctMapels[0].name);
    }
  }, [distinctMapels, mapelId]);

  // Inisialisasi Kelas otomatis jika belum terpilih atau tidak valid untuk mapel
  useEffect(() => {
    if (distinctClasses.length > 0 && (!kelas || !distinctClasses.includes(kelas))) {
      setKelas(distinctClasses[0]);
    }
  }, [distinctClasses, kelas]);

  // Memuat Riwayat LKH dari Cache Lokal dan Google Apps Script
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      // 1. Tampilkan riwayat lokal terlebih dahulu secara instan (zero latency)
      const local = localStorage.getItem('ajar_lkh_records');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) {
            setHistoryRecords(parsed);
          }
        } catch {}
      }

      // 2. Sinkronkan dengan server backend GAS
      const res = await callGasApi('getLkhData', [token]);
      if (res && (res as any).success && Array.isArray((res as any).records)) {
        setHistoryRecords((res as any).records);
        try {
          localStorage.setItem('ajar_lkh_records', JSON.stringify((res as any).records));
        } catch {}
      }
    } catch {
      showToast('Gagal memuat riwayat LKH.', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Muat riwayat saat awal dan saat tab riwayat dibuka
  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  // Handler Submit Jurnal LKH
  const handleSubmitLkh = async () => {
    if (!tanggal) {
      showToast('Pilih tanggal kegiatan!', 'warning');
      return;
    }
    if (!isNonKbm && (!mapelId || !kelas)) {
      showToast('Pilih mata pelajaran dan kelas binaan!', 'warning');
      return;
    }
    if (!uraian.trim()) {
      showToast('Tuliskan uraian aktivitas kerja!', 'warning');
      return;
    }
    if (!isNonKbm && !hasil.trim()) {
      showToast('Tuliskan hasil/ketercapaian pembelajaran!', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload: LkhRecord = {
        Tanggal: tanggal,
        tanggal: tanggal,
        IsNonKbm: isNonKbm,
        isNonKbm: isNonKbm,
        MataPelajaranID: isNonKbm ? '' : mapelId,
        mapelId: isNonKbm ? '' : mapelId,
        mapelNama: isNonKbm ? 'Kegiatan Non-KBM / Dinas Luar' : mapelNama,
        JamMulai: jamMulai,
        jamMulai: jamMulai,
        JamSelesai: jamSelesai,
        jamSelesai: jamSelesai,
        Kelas: isNonKbm ? 'Dinas Luar' : kelas,
        kelas: isNonKbm ? 'Dinas Luar' : kelas,
        UraianKerja: uraian.trim(),
        uraian: uraian.trim(),
        HasilPembelajaran: isNonKbm ? 'Terlaksana sesuai agenda dinas' : hasil.trim(),
        hasil: isNonKbm ? 'Terlaksana sesuai agenda dinas' : hasil.trim(),
        ParafUrl: currentUser?.parafUrl || '',
        parafUrl: currentUser?.parafUrl || '',
      };

      const res = await callGasApi('saveLkhRecord', [token, payload]);
      if (res && (res as any).success) {
        showToast('Jurnal LKH berhasil disimpan!', 'success');
        // Reset kolom uraian dan hasil untuk input berikutnya
        setUraian('');
        setHasil('');
        // Alihkan ke tab riwayat untuk melihat hasil input
        setActiveTab('history');
        loadHistory();
      } else {
        showToast((res as any)?.message || 'Gagal menyimpan Jurnal LKH.', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handler Salin ke Form (Duplikasi Cepat dari Riwayat)
  const handleCopyRecord = (rec: LkhRecord) => {
    const isNonKbmRec = Boolean(rec.IsNonKbm ?? rec.isNonKbm);
    setIsNonKbm(isNonKbmRec);

    if (rec.MataPelajaranID || rec.mapelId) {
      setMapelId(rec.MataPelajaranID || rec.mapelId || '');
      setMapelNama(rec.mapelNama || '');
    }
    if (rec.Kelas || rec.kelas) {
      setKelas(rec.Kelas || rec.kelas || '');
    }
    if (rec.JamMulai !== undefined || rec.jamMulai !== undefined) {
      setJamMulai(rec.JamMulai ?? rec.jamMulai ?? 1);
    }
    if (rec.JamSelesai !== undefined || rec.jamSelesai !== undefined) {
      setJamSelesai(rec.JamSelesai ?? rec.jamSelesai ?? 2);
    }
    setUraian(rec.UraianKerja || rec.uraian || '');
    setHasil(rec.HasilPembelajaran || rec.hasil || '');
    setTanggal(new Date().toISOString().split('T')[0]);

    setActiveTab('form');
    showToast('Data jurnal berhasil disalin ke formulir.', 'info');
  };

  // Handler Hapus Record LKH
  const handleDeleteRecord = async (lkhId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus catatan jurnal ini?')) return;
    try {
      const res = await callGasApi('deleteLkhRecord', [token, lkhId]);
      if (res && (res as any).success) {
        showToast('Jurnal LKH berhasil dihapus.', 'success');
        setHistoryRecords(prev => prev.filter(r => (r.LkhID || r.lkhId) !== lkhId));
      } else {
        showToast('Gagal menghapus jurnal LKH.', 'error');
      }
    } catch {
      showToast('Gagal menghapus jurnal.', 'error');
    }
  };

  // Filter Riwayat berdasarkan Pencarian Kata Kunci
  const filteredHistory = useMemo(() => {
    const q = historySearch.toLowerCase().trim();
    if (!q) return historyRecords;
    return historyRecords.filter(r => {
      const dateStr = String(r.Tanggal || r.tanggal || '').toLowerCase();
      const mapelStr = String(r.mapelNama || r.MataPelajaranID || '').toLowerCase();
      const kelasStr = String(r.Kelas || r.kelas || '').toLowerCase();
      const uraianStr = String(r.UraianKerja || r.uraian || '').toLowerCase();
      const hasilStr = String(r.HasilPembelajaran || r.hasil || '').toLowerCase();
      return (
        dateStr.includes(q) ||
        mapelStr.includes(q) ||
        kelasStr.includes(q) ||
        uraianStr.includes(q) ||
        hasilStr.includes(q)
      );
    });
  }, [historyRecords, historySearch]);

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col gap-2.5 select-none overflow-hidden">
      {/* ========================================================================= */}
      {/* 1. HEADER INFORMASI JURNAL LKH                                            */}
      {/* ========================================================================= */}
      <div className="neu-raised-card bg-[#EEF2F6] rounded-2xl p-3 border border-white/90 shrink-0 flex items-center justify-between shadow-xs">
        <div className="min-w-0 pr-1">
          <h2 className="text-sm font-semibold text-[#0D162B] tracking-tight truncate flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-blue-600 stroke-[2.2]" />
            <span>Jurnal Kerja Harian (LKH)</span>
          </h2>
          <p className="text-[11px] font-medium text-blue-700 font-mono tabular-nums mt-0.5">
            Semester {autoSemester} • T.A {tahunAjaran}
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl neu-pressed bg-[#E8EEF6] text-[11px] font-medium text-slate-700 font-mono tabular-nums border border-white/70">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
            {historyRecords.length} Catatan
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SEGMENTED TAB SWITCHER (Formulir Jurnal vs Riwayat Jurnal)              */}
      {/* ========================================================================= */}
      <div className="neu-pressed bg-[#E8EEF6] p-1 rounded-2xl shrink-0 flex items-center border border-white/70 shadow-inner">
        <button
          type="button"
          onClick={() => setActiveTab('form')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'form'
              ? 'neu-flat bg-[#EEF2F6] text-blue-700 font-medium shadow-xs border border-white/80'
              : 'text-slate-500 font-normal hover:text-slate-800'
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Formulir Jurnal</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'history'
              ? 'neu-flat bg-[#EEF2F6] text-blue-700 font-medium shadow-xs border border-white/80'
              : 'text-slate-500 font-normal hover:text-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Riwayat Jurnal ({historyRecords.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. KONTEN UTAMA: TAB FORMULIR JURNAL                                      */}
      {/* ========================================================================= */}
      {activeTab === 'form' ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Scrollable Form Cards Container */}
          <div className="flex-1 min-h-0 overflow-y-auto touch-scroll overscroll-contain pr-1 space-y-3 pb-3">
            {/* KARTU 1: KLASIFIKASI AGENDA & TANGGAL */}
            <div className="neu-raised-card bg-[#EEF2F6] rounded-2xl p-3 sm:p-3.5 border border-white/90 shadow-xs space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1.5">
                  Klasifikasi Kegiatan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNonKbm(false)}
                    className={`py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer ${
                      !isNonKbm
                        ? 'neu-pressed bg-[#E2ECF9] text-blue-700 font-medium border border-blue-300/80 shadow-inner'
                        : 'neu-flat bg-[#EEF2F6] text-slate-600 font-normal hover:bg-white/50 border border-white/80'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Kegiatan KBM</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsNonKbm(true)}
                    className={`py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer ${
                      isNonKbm
                        ? 'neu-pressed bg-[#E2ECF9] text-blue-700 font-medium border border-blue-300/80 shadow-inner'
                        : 'neu-flat bg-[#EEF2F6] text-slate-600 font-normal hover:bg-white/50 border border-white/80'
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>Non-KBM / Dinas Luar</span>
                  </button>
                </div>
              </div>

              {/* TANGGAL PELAKSANAAN & PINTASAN HARI INI / KEMARIN */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider">
                    Tanggal Pelaksanaan
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTanggal(new Date().toISOString().split('T')[0])}
                      className="px-2 py-0.5 rounded-lg neu-btn bg-[#EEF2F6] text-[11px] font-medium text-blue-700 hover:text-blue-800 active:scale-95 cursor-pointer"
                    >
                      Hari Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const y = new Date(Date.now() - 86400000);
                        setTanggal(y.toISOString().split('T')[0]);
                      }}
                      className="px-2 py-0.5 rounded-lg neu-btn bg-[#EEF2F6] text-[11px] font-medium text-slate-600 hover:text-slate-800 active:scale-95 cursor-pointer"
                    >
                      Kemarin
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="date"
                    value={tanggal}
                    onChange={e => setTanggal(e.target.value)}
                    className="w-full h-11 rounded-2xl neu-pressed bg-[#E8EEF6] border border-white/80 px-3 text-xs font-medium font-mono tabular-nums text-[#0D162B] outline-none focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* KARTU 2: MATA PELAJARAN & KELAS (KBM ONLY) */}
            {!isNonKbm ? (
              <div className="neu-raised-card bg-[#EEF2F6] rounded-2xl p-3 sm:p-3.5 border border-white/90 shadow-xs space-y-3">
                {pengajaranList.length === 0 ? (
                  <div className="p-3 rounded-xl neu-pressed bg-[#E8EEF6] border border-amber-300/60 text-amber-800 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Rombel mengajar belum dikonfigurasi di Master Ajar.</span>
                    </div>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('master-ajar')}
                        className="px-2.5 py-1 rounded-lg neu-btn bg-[#EEF2F6] text-[11px] font-medium text-blue-700 shrink-0 cursor-pointer"
                      >
                        Buka Master Ajar
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Pilih Mata Pelajaran */}
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1.5">
                        Mata Pelajaran
                      </label>
                      <div className="relative">
                        <select
                          value={mapelId}
                          onChange={e => {
                            const newId = e.target.value;
                            setMapelId(newId);
                            const found = distinctMapels.find(m => m.id === newId);
                            setMapelNama(found?.name || newId);
                          }}
                          className="neu-select w-full h-11 rounded-2xl px-3 text-xs font-medium text-[#0D162B] outline-none cursor-pointer"
                        >
                          {distinctMapels.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-3.5 pointer-events-none" />
                      </div>
                    </div>

                    {/* Pilih Kelas Binaan */}
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1.5">
                        Kelas Binaan
                      </label>
                      <div className="relative">
                        <select
                          value={kelas}
                          onChange={e => setKelas(e.target.value)}
                          className="neu-select w-full h-11 rounded-2xl px-3 text-xs font-medium text-[#0D162B] outline-none cursor-pointer"
                        >
                          {distinctClasses.map(k => (
                            <option key={k} value={k}>
                              Kelas {k}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-3.5 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-2xl neu-pressed bg-[#E8EEF6] border border-blue-200/60 text-slate-600 text-xs flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Mode Non-KBM aktif: Kegiatan dicatat sebagai tugas kedinasan / luar kelas (Otomatis ditandai Dinas Luar).
                </span>
              </div>
            )}

            {/* KARTU 3: RENTANG JAM PELAJARAN & PINTASAN CEPAT */}
            <div className="neu-raised-card bg-[#EEF2F6] rounded-2xl p-3 sm:p-3.5 border border-white/90 shadow-xs space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1.5">
                    Dari Jam Ke
                  </label>
                  <div className="relative">
                    <select
                      value={jamMulai}
                      onChange={e => setJamMulai(e.target.value ? Number(e.target.value) : '')}
                      className="neu-select w-full h-11 rounded-2xl px-3 text-xs font-medium text-[#0D162B] outline-none cursor-pointer"
                    >
                      <option value="">Tanpa Jam</option>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(j => (
                        <option key={j} value={j}>
                          Jam Ke-{j}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-3.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1.5">
                    Sampai Jam Ke
                  </label>
                  <div className="relative">
                    <select
                      value={jamSelesai}
                      onChange={e => setJamSelesai(e.target.value ? Number(e.target.value) : '')}
                      className="neu-select w-full h-11 rounded-2xl px-3 text-xs font-medium text-[#0D162B] outline-none cursor-pointer"
                    >
                      <option value="">Tanpa Jam</option>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(j => (
                        <option key={j} value={j}>
                          Jam Ke-{j}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-3.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Pintasan Cepat Jam */}
              <div>
                <span className="block text-[11px] font-medium text-slate-500 mb-1.5">
                  Pintasan Rentang Jam:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    [1, 2],
                    [3, 4],
                    [5, 6],
                    [7, 8],
                  ].map(([m, s]) => {
                    const isSelected = jamMulai === m && jamSelesai === s;
                    return (
                      <button
                        key={`${m}-${s}`}
                        type="button"
                        onClick={() => {
                          setJamMulai(m);
                          setJamSelesai(s);
                        }}
                        className={`px-2.5 py-1 rounded-xl text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'neu-pressed bg-[#E2ECF9] text-blue-700 font-medium border border-blue-300/70'
                            : 'neu-btn bg-[#EEF2F6] text-slate-600 font-normal hover:text-slate-900 active:scale-95'
                        }`}
                      >
                        Jam {m}-{s}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setJamMulai('');
                      setJamSelesai('');
                    }}
                    className={`px-2.5 py-1 rounded-xl text-xs transition-all cursor-pointer ${
                      jamMulai === '' && jamSelesai === ''
                        ? 'neu-pressed bg-[#E2ECF9] text-blue-700 font-medium border border-blue-300/70'
                        : 'neu-btn bg-[#EEF2F6] text-slate-600 font-normal hover:text-slate-900 active:scale-95'
                    }`}
                  >
                    Sehari Penuh
                  </button>
                </div>
              </div>
            </div>

            {/* KARTU 4: URAIAN AKTIVITAS KERJA */}
            <div className="neu-raised-card bg-[#EEF2F6] rounded-2xl p-3 sm:p-3.5 border border-white/90 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider">
                  Uraian Aktivitas yang Dilaksanakan
                </label>
                <span className="text-[11px] text-blue-700 font-medium flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Saran Pintar</span>
                </span>
              </div>

              {/* Chips Saran Pintar Uraian */}
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto no-scrollbar py-0.5">
                {DEFAULT_SUGGESTIONS_URAIAN.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setUraian(item)}
                    className="px-2.5 py-1 rounded-xl neu-btn bg-[#EEF2F6] text-[11px] text-slate-600 hover:text-blue-700 font-normal text-left active:scale-95 transition-all cursor-pointer leading-tight"
                  >
                    {item}
                  </button>
                ))}
              </div>

              {/* Textarea Uraian */}
              <div>
                <textarea
                  rows={3}
                  value={uraian}
                  onChange={e => setUraian(e.target.value)}
                  placeholder="Tuliskan uraian aktivitas kerja secara lengkap dan terstruktur..."
                  className="w-full rounded-2xl neu-pressed bg-[#E8EEF6] border border-white/80 p-3 text-xs text-[#0D162B] placeholder:text-slate-400 font-normal outline-none focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* KARTU 5: HASIL PEMBELAJARAN (KBM ONLY) */}
            {!isNonKbm && (
              <div className="neu-raised-card bg-[#EEF2F6] rounded-2xl p-3 sm:p-3.5 border border-white/90 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider">
                    Hasil / Ketercapaian Pembelajaran
                  </label>
                  <span className="text-[11px] text-blue-700 font-medium flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Saran Ketercapaian</span>
                  </span>
                </div>

                {/* Chips Saran Pintar Hasil */}
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto no-scrollbar py-0.5">
                  {DEFAULT_SUGGESTIONS_HASIL.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setHasil(item)}
                      className="px-2.5 py-1 rounded-xl neu-btn bg-[#EEF2F6] text-[11px] text-slate-600 hover:text-blue-700 font-normal text-left active:scale-95 transition-all cursor-pointer leading-tight"
                    >
                      {item}
                    </button>
                  ))}
                </div>

                {/* Textarea Hasil */}
                <div>
                  <textarea
                    rows={3}
                    value={hasil}
                    onChange={e => setHasil(e.target.value)}
                    placeholder="Contoh: Siswa memahami materi dengan baik dan menyelesaikan latihan soal mandiri..."
                    className="w-full rounded-2xl neu-pressed bg-[#E8EEF6] border border-white/80 p-3 text-xs text-[#0D162B] placeholder:text-slate-400 font-normal outline-none focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* KARTU 6: VERIFIKASI & PARAF DIGITAL GURU */}
            <div className="neu-raised-card bg-[#EEF2F6] rounded-2xl p-3 sm:p-3.5 border border-white/90 shadow-xs flex items-center justify-between gap-3">
              <div className="min-w-0 pr-1">
                <span className="text-[11px] font-medium text-blue-700 uppercase tracking-wider block">
                  Paraf Digital Guru
                </span>
                <p className="text-xs font-semibold text-[#0D162B] truncate mt-0.5">
                  {currentUser?.namaTampilan || currentUser?.namaLengkap || 'Guru Mata Pelajaran'}
                </p>
                <p className="text-[11px] font-mono tabular-nums text-slate-500">
                  NIP. {currentUser?.nip || '-'}
                </p>
              </div>

              <div className="h-12 w-28 rounded-xl neu-pressed bg-[#E8EEF6] border border-white/80 flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
                {currentUser?.parafUrl ? (
                  <img
                    src={currentUser.parafUrl}
                    alt="Paraf Guru"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] font-medium font-mono text-slate-400">
                    [Otomatis Tersemat]
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* DOCKED SAVE BUTTON (Mobile-First Bottom Dock) */}
          <div className="shrink-0 pt-2 border-t border-[#d4deeb]/70 bg-[#EEF2F6]">
            <button
              type="button"
              onClick={handleSubmitLkh}
              disabled={submitting}
              className="w-full h-11 neu-btn-primary bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl text-xs font-medium flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Menyimpan Jurnal LKH...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-white" />
                  <span>Simpan Jurnal LKH</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 4. KONTEN UTAMA: TAB RIWAYAT JURNAL TERSIMPAN                             */
        /* ========================================================================= */
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden space-y-2.5">
          {/* Sub-bar: Filter Pencarian & Tombol Refresh */}
          <div className="shrink-0 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Cari tanggal, mapel, kelas, atau uraian..."
                className="w-full h-9 rounded-xl neu-pressed bg-[#E8EEF6] border border-white/80 pl-9 pr-3 text-xs text-[#0D162B] placeholder:text-slate-400 font-normal outline-none focus:border-blue-500/80 transition-all"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={loadHistory}
              disabled={loadingHistory}
              title="Perbarui Riwayat Jurnal"
              className="h-9 w-9 rounded-xl neu-btn bg-[#EEF2F6] flex items-center justify-center text-slate-600 hover:text-blue-700 active:scale-95 transition-all cursor-pointer shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>

          {/* Daftar Kartu Riwayat */}
          <div className="flex-1 min-h-0 overflow-y-auto touch-scroll overscroll-contain pr-1 space-y-2.5">
            {loadingHistory && historyRecords.length === 0 ? (
              <div className="p-8 text-center neu-raised-card bg-[#EEF2F6] rounded-2xl border border-white/90">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-normal">Memuat catatan riwayat LKH...</p>
              </div>
            ) : filteredHistory.length > 0 ? (
              filteredHistory.map((rec, idx) => {
                const recId = rec.LkhID || rec.lkhId || `lkh-${idx}`;
                const isNonKbmRec = Boolean(rec.IsNonKbm ?? rec.isNonKbm);
                const tgl = rec.Tanggal || rec.tanggal || '-';
                const jmMulai = rec.JamMulai ?? rec.jamMulai;
                const jmSelesai = rec.JamSelesai ?? rec.jamSelesai;
                const jamStr = jmMulai ? `Jam ${jmMulai}-${jmSelesai}` : 'Sehari Penuh';

                return (
                  <div
                    key={recId}
                    className="neu-raised-card bg-[#EEF2F6] rounded-2xl p-3 sm:p-3.5 border border-white/90 shadow-xs hover:bg-[#F3F7FB] transition-all space-y-2"
                  >
                    {/* Header Bar Kartu Riwayat */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        {/* Tanggal */}
                        <span className="px-2 py-0.5 rounded-lg neu-pressed bg-[#E8EEF6] text-blue-700 font-mono tabular-nums text-[11px] font-medium border border-white/80">
                          {tgl}
                        </span>

                        {/* Jam */}
                        <span className="px-2 py-0.5 rounded-lg neu-inset bg-[#E8EEF6] text-slate-600 font-mono tabular-nums text-[11px] font-normal border border-white/60">
                          {jamStr}
                        </span>

                        {/* Status KBM / Rombel */}
                        {isNonKbmRec ? (
                          <span className="px-2 py-0.5 rounded-lg neu-pressed bg-amber-50 text-amber-800 text-[11px] font-medium border border-amber-200/60">
                            Non-KBM / Dinas Luar
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg neu-pressed bg-blue-50 text-blue-800 text-[11px] font-medium border border-blue-200/60 truncate max-w-[200px]">
                            {rec.mapelNama || rec.MataPelajaranID} • Kelas {rec.Kelas || rec.kelas}
                          </span>
                        )}
                      </div>

                      {/* Tombol Aksi: Salin ke Form & Hapus */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyRecord(rec)}
                          title="Salin data ini ke formulir jurnal"
                          className="p-1.5 rounded-xl neu-btn bg-[#EEF2F6] text-slate-600 hover:text-blue-700 active:scale-95 transition-all cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(recId)}
                          title="Hapus Catatan Jurnal"
                          className="p-1.5 rounded-xl neu-btn bg-[#EEF2F6] text-slate-400 hover:text-rose-600 active:scale-95 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Uraian Aktivitas Kerja */}
                    <div>
                      <p className="text-xs text-[#0D162B] font-normal leading-relaxed">
                        {rec.UraianKerja || rec.uraian || '-'}
                      </p>
                    </div>

                    {/* Hasil Pembelajaran (jika ada) */}
                    {!isNonKbmRec && (rec.HasilPembelajaran || rec.hasil) && (
                      <div className="pt-1 border-t border-[#d4deeb]/60">
                        <p className="text-[11px] text-slate-500 font-normal italic leading-relaxed">
                          <span className="font-medium not-italic text-slate-600">Hasil: </span>
                          {rec.HasilPembelajaran || rec.hasil}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              /* State Kosong / Belum Ada Catatan */
              <div className="neu-raised-card bg-[#EEF2F6] rounded-2xl p-8 border border-white/90 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl neu-inset bg-[#E8EEF6] text-blue-600 flex items-center justify-center mx-auto">
                  <CalendarDays className="w-6 h-6 stroke-[2]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-[#0D162B]">
                    Belum Ada Catatan Jurnal LKH
                  </h3>
                  <p className="text-[11px] text-slate-500 font-normal max-w-xs mx-auto">
                    {historySearch
                      ? 'Tidak ditemukan jurnal LKH yang sesuai dengan kata kunci pencarian.'
                      : 'Mulai catat aktivitas pembelajaran dan kedinasan harian Anda pada tab formulir.'}
                  </p>
                </div>
                {!historySearch && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('form')}
                      className="px-3.5 py-2 rounded-xl neu-btn bg-[#EEF2F6] text-xs font-medium text-blue-700 hover:text-blue-800 active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Isi Jurnal Sekarang</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
