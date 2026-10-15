import React, { useState, useEffect } from 'react';
import {
  Calendar,
  BookOpen,
  Clock,
  GraduationCap,
  FileText,
  Award,
  CheckCircle2,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  List,
  PlusCircle,
} from 'lucide-react';
import { LkhRecord, PengajaranItem, User } from '../types';
import { callGasApi } from '../services/gasApi';

interface LkhWizardProps {
  token: string;
  currentUser: User | null;
  pengajaranList: PengajaranItem[];
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const LkhWizard: React.FC<LkhWizardProps> = ({
  token,
  currentUser,
  pengajaranList,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'wizard' | 'history'>('wizard');

  // Wizard state
  const [step, setStep] = useState(1);
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [isNonKbm, setIsNonKbm] = useState(false);
  const [mapelId, setMapelId] = useState('');
  const [mapelNama, setMapelNama] = useState('');
  const [jamMulai, setJamMulai] = useState<number | string>(1);
  const [jamSelesai, setJamSelesai] = useState<number | string>(2);
  const [kelas, setKelas] = useState('');
  const [uraian, setUraian] = useState('');
  const [hasil, setHasil] = useState('');

  // History state
  const [historyRecords, setHistoryRecords] = useState<LkhRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Suggestions
  const [suggestionsUraian, setSuggestionsUraian] = useState<string[]>([
    'Melaksanakan kegiatan pembelajaran materi pokok sesuai modul ajar',
    'Memberikan bimbingan diskusi kelompok dan praktikum siswa',
    'Melaksanakan asesmen formatif harian dan pembahasan evaluasi soal',
    'Melakukan pendampingan remedi dan pengayaan materi peserta didik',
    'Mengikuti pembiasaan tadarus Al-Qur\'an dan sholat dhuha berjamaah',
    'Menghadiri rapat dinas koordinasi evaluasi kurikulum madrasah',
  ]);

  const [suggestionsHasil, setSuggestionsHasil] = useState<string[]>([
    'Siswa memahami materi dengan baik dan aktif berdiskusi (ketercapaian 88%)',
    'Seluruh peserta didik menyelesaikan tugas asesmen formatif tepat waktu',
    'Tercapai ketuntasan tujuan pembelajaran sesuai target modul ajar',
    'Kegiatan koordinasi berjalan lancar dan menghasilkan notulen tindak lanjut',
  ]);

  // Unique mapels and classes from teacher's pengajaran
  const distinctMapels = Array.from(
    new Map(pengajaranList.map(p => [p.mapelId, p.mapelNama || p.mapelId])).entries()
  ).map(([id, name]) => ({ id, name }));

  const availableClassesForMapel = pengajaranList
    .filter(p => (mapelId ? p.mapelId === mapelId : true))
    .map(p => p.kelas || '')
    .filter(Boolean);

  const distinctClasses = Array.from(new Set(availableClassesForMapel));

  useEffect(() => {
    if (distinctMapels.length > 0 && !mapelId) {
      setMapelId(distinctMapels[0].id);
      setMapelNama(distinctMapels[0].name);
    }
  }, [distinctMapels]);

  useEffect(() => {
    if (distinctClasses.length > 0 && !kelas) {
      setKelas(distinctClasses[0]);
    }
  }, [distinctClasses]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await callGasApi('getLkhData', [token]);
      if (res && res.success) {
        setHistoryRecords(res.records || []);
      }
    } catch {
      showToast('Gagal memuat riwayat LKH.', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const handleNext = () => {
    if (step === 1 && !tanggal) {
      showToast('Pilih tanggal kegiatan!', 'warning');
      return;
    }
    if (step === 2) {
      if (isNonKbm) {
        // Skip mapel step for non-kbm -> jump to rentang jam
        setStep(4);
        return;
      }
    }
    if (step === 3 && !isNonKbm && !mapelId) {
      showToast('Pilih mata pelajaran yang diajarkan!', 'warning');
      return;
    }
    if (step === 5 && !isNonKbm && !kelas) {
      showToast('Pilih kelas kegiatan!', 'warning');
      return;
    }
    if (step === 6 && !uraian.trim()) {
      showToast('Tuliskan uraian aktivitas kerja!', 'warning');
      return;
    }
    if (step === 7 && !isNonKbm && !hasil.trim()) {
      showToast('Tuliskan hasil/ketercapaian pembelajaran!', 'warning');
      return;
    }

    if (step === 4 && isNonKbm) {
      // Non-KBM skips kelas -> go straight to uraian
      setStep(6);
      return;
    }

    if (step === 6 && isNonKbm) {
      // Non-KBM skips hasil -> go straight to review step 8
      setStep(8);
      return;
    }

    setStep(prev => Math.min(8, prev + 1));
  };

  const handlePrev = () => {
    if (step === 8 && isNonKbm) {
      setStep(6);
      return;
    }
    if (step === 6 && isNonKbm) {
      setStep(4);
      return;
    }
    if (step === 4 && isNonKbm) {
      setStep(2);
      return;
    }
    setStep(prev => Math.max(1, prev - 1));
  };

  const handleSubmitLkh = async () => {
    setSubmitting(true);
    try {
      const payload: LkhRecord = {
        Tanggal: tanggal,
        tanggal: tanggal,
        IsNonKbm: isNonKbm,
        isNonKbm: isNonKbm,
        MataPelajaranID: isNonKbm ? '' : mapelId,
        mapelId: isNonKbm ? '' : mapelId,
        mapelNama: isNonKbm ? 'Kegiatan Non-KBM' : mapelNama,
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
      };

      const res = await callGasApi('saveLkhRecord', [token, payload]);
      if (res && res.success) {
        showToast('Jurnal LKH berhasil disimpan!', 'success');
        // Reset wizard
        setStep(1);
        setUraian('');
        setHasil('');
        setActiveTab('history');
        loadHistory();
      } else {
        showToast(res?.message || 'Gagal menyimpan Jurnal LKH.', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRecord = async (lkhId: string) => {
    if (!window.confirm('Hapus catatan jurnal ini?')) return;
    try {
      const res = await callGasApi('deleteLkhRecord', [token, lkhId]);
      if (res && res.success) {
        showToast('Jurnal LKH berhasil dihapus.', 'success');
        setHistoryRecords(prev => prev.filter(r => (r.LkhID || r.lkhId) !== lkhId));
      }
    } catch {
      showToast('Gagal menghapus jurnal.', 'error');
    }
  };

  const stepPercent = Math.round((step / 8) * 100);

  return (
    <div className="space-y-4 pb-28">
      {/* Tab Switcher: Wizard vs Riwayat */}
      <div className="bg-white/15 backdrop-blur-md p-1.5 rounded-2xl flex items-center space-x-1 border border-white/10 shadow-lg">
        <button
          onClick={() => setActiveTab('wizard')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'wizard'
              ? 'bg-[#facc15] text-slate-900 shadow-md'
              : 'text-white/70 hover:text-white'
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Isi Jurnal Baru</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-[#facc15] text-slate-900 shadow-md font-black'
              : 'text-white/70 hover:text-white'
          }`}
        >
          <List className="w-3.5 h-3.5" />
          <span>Riwayat Jurnal</span>
        </button>
      </div>

      {activeTab === 'wizard' ? (
        <div className="bg-white/15 backdrop-blur-xl rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 text-white border border-white/15">
          {/* Progress Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-[#fde047]">
                Langkah {step} dari 8
              </span>
              <span className="font-black text-white/80">{stepPercent}%</span>
            </div>
            <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#fde047] to-[#facc15] h-full rounded-full transition-all duration-300"
                style={{ width: `${stepPercent}%` }}
              />
            </div>
          </div>

          {/* STEP 1: TANGGAL */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-1">
                <span className="text-[11px] font-extrabold uppercase text-[#fde047] tracking-wider">
                  Langkah 1
                </span>
                <h3 className="text-base font-black text-white">
                  Kapan aktivitas ini dilaksanakan?
                </h3>
                <p className="text-xs text-white/80">
                  Pilih tanggal pelaksanaan KBM atau kegiatan dinas harian.
                </p>
              </div>

              <div className="pt-2">
                <input
                  type="date"
                  value={tanggal}
                  onChange={e => setTanggal(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-2xl p-3.5 text-center text-sm font-bold text-white outline-none focus:border-[#fde047]"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setTanggal(new Date().toISOString().split('T')[0])}
                  className="flex-1 py-2.5 bg-white/20 active:bg-white/30 text-white rounded-full text-xs font-bold transition-all cursor-pointer"
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const y = new Date(Date.now() - 86400000);
                    setTanggal(y.toISOString().split('T')[0]);
                  }}
                  className="flex-1 py-2.5 bg-white/20 active:bg-white/30 text-white rounded-full text-xs font-bold transition-all cursor-pointer"
                >
                  Kemarin
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: KLASIFIKASI AGENDA */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-1">
                <span className="text-[11px] font-extrabold uppercase text-[#fde047] tracking-wider">
                  Langkah 2
                </span>
                <h3 className="text-base font-black text-white">
                  Apa klasifikasi agenda kegiatan?
                </h3>
                <p className="text-xs text-white/80">Pilih jenis kegiatan yang Anda lakukan.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-2">
                <div
                  onClick={() => {
                    setIsNonKbm(false);
                    handleNext();
                  }}
                  className={`step-card p-4 rounded-3xl flex items-center space-x-3.5 border transition-all cursor-pointer ${
                    !isNonKbm ? 'active-card' : 'bg-white/15 border-white/10'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-white/20 text-[#fde047] flex items-center justify-center shrink-0">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-black leading-tight">Kegiatan Mengajar (KBM)</h4>
                    <p className="text-[11px] opacity-80 font-medium mt-0.5">
                      Pembelajaran materi pelajaran di kelas binaan.
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => {
                    setIsNonKbm(true);
                    setStep(4);
                  }}
                  className={`step-card p-4 rounded-3xl flex items-center space-x-3.5 border transition-all cursor-pointer ${
                    isNonKbm ? 'active-card' : 'bg-white/15 border-white/10'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-white/20 text-[#fde047] flex items-center justify-center shrink-0">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-black leading-tight">
                      Kegiatan Non-KBM / Dinas Luar
                    </h4>
                    <p className="text-[11px] opacity-80 font-medium mt-0.5">
                      Upacara, rapat dinas, briefing, pembiasaan atau tugas luar.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: MATA PELAJARAN */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-1">
                <span className="text-[11px] font-extrabold uppercase text-[#fde047] tracking-wider">
                  Langkah 3
                </span>
                <h3 className="text-base font-black text-white">
                  Mata Pelajaran apa yang diajarkan?
                </h3>
                <p className="text-xs text-white/80">Pilih subjek pengajaran aktif Anda.</p>
              </div>

              <div className="grid grid-cols-1 gap-2.5 pt-2 max-h-60 overflow-y-auto touch-scroll pr-1">
                {distinctMapels.map(m => {
                  const isSelected = mapelId === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        setMapelId(m.id);
                        setMapelNama(m.name);
                        handleNext();
                      }}
                      className={`step-card p-3.5 rounded-2xl flex items-center justify-between border cursor-pointer transition-all ${
                        isSelected ? 'active-card' : 'bg-white/15 border-white/10'
                      }`}
                    >
                      <span className="text-xs font-extrabold">{m.name}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-slate-900" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: RENTANG JAM PELAJARAN */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-1">
                <span className="text-[11px] font-extrabold uppercase text-[#fde047] tracking-wider">
                  Langkah 4
                </span>
                <h3 className="text-base font-black text-white">Rentang jam pelajaran berapa?</h3>
                <p className="text-xs text-white/80">
                  Tentukan jam mulai dan jam selesai kegiatan.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#fde047] mb-1 uppercase tracking-wider">
                    Dari Jam Ke
                  </label>
                  <select
                    value={jamMulai}
                    onChange={e => setJamMulai(e.target.value)}
                    className="w-full bg-[#002830] border border-white/20 rounded-2xl p-2.5 text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    <option value="">Tanpa Jam</option>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(j => (
                      <option key={j} value={j}>
                        Jam Ke-{j}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#fde047] mb-1 uppercase tracking-wider">
                    Sampai Jam Ke
                  </label>
                  <select
                    value={jamSelesai}
                    onChange={e => setJamSelesai(e.target.value)}
                    className="w-full bg-[#002830] border border-white/20 rounded-2xl p-2.5 text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    <option value="">Tanpa Jam</option>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(j => (
                      <option key={j} value={j}>
                        Jam Ke-{j}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] font-bold text-white/80 uppercase">Pintasan Cepat Jam</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    [1, 2],
                    [3, 4],
                    [5, 6],
                    [7, 8],
                  ].map(([m, s]) => (
                    <button
                      key={`${m}-${s}`}
                      type="button"
                      onClick={() => {
                        setJamMulai(m);
                        setJamSelesai(s);
                      }}
                      className="px-3.5 py-1.5 bg-white/20 active:bg-white/30 text-white rounded-full text-xs font-bold cursor-pointer"
                    >
                      Jam {m} - {s}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setJamMulai('');
                      setJamSelesai('');
                    }}
                    className="px-3.5 py-1.5 bg-amber-400/25 text-amber-300 border border-amber-400/40 rounded-full text-xs font-bold cursor-pointer"
                  >
                    Tanpa Jam (Sehari Penuh)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: KELAS */}
          {step === 5 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-1">
                <span className="text-[11px] font-extrabold uppercase text-[#fde047] tracking-wider">
                  Langkah 5
                </span>
                <h3 className="text-base font-black text-white">
                  Di kelas mana kegiatan berlangsung?
                </h3>
                <p className="text-xs text-white/80">Pilih salah satu kelas binaan Anda.</p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2 max-h-56 overflow-y-auto touch-scroll pr-1">
                {distinctClasses.map(k => {
                  const isSelected = kelas === k;
                  return (
                    <div
                      key={k}
                      onClick={() => {
                        setKelas(k);
                        handleNext();
                      }}
                      className={`step-card p-3 rounded-2xl flex items-center justify-between border cursor-pointer transition-all ${
                        isSelected ? 'active-card' : 'bg-white/15 border-white/10'
                      }`}
                    >
                      <span className="text-xs font-extrabold truncate">{k}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-slate-900" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 6: URAIAN KERJA */}
          {step === 6 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-1">
                <span className="text-[11px] font-extrabold uppercase text-[#fde047] tracking-wider">
                  Langkah 6
                </span>
                <h3 className="text-base font-black text-white">
                  Uraian aktivitas yang dilaksanakan
                </h3>
                <p className="text-xs text-white/80">
                  Pilih dari saran pintar atau ketik langsung tugas harian.
                </p>
              </div>

              {/* Smart Suggestion Chips */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-[#fde047] uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#fde047]" />
                  <span>Saran Pintar Uraian:</span>
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto touch-scroll pb-1">
                  {suggestionsUraian.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setUraian(item)}
                      className="suggestion-chip text-left"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-1">
                <textarea
                  rows={3}
                  value={uraian}
                  onChange={e => setUraian(e.target.value)}
                  placeholder="Tuliskan uraian aktivitas kerja secara lengkap..."
                  className="w-full bg-white/15 text-white placeholder-white/40 border border-white/20 focus:border-[#fde047] rounded-2xl p-3.5 text-xs font-semibold outline-none resize-none backdrop-blur-sm"
                />
              </div>
            </div>
          )}

          {/* STEP 7: HASIL PEMBELAJARAN */}
          {step === 7 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-1">
                <span className="text-[11px] font-extrabold uppercase text-[#fde047] tracking-wider">
                  Langkah 7
                </span>
                <h3 className="text-base font-black text-white">
                  Hasil / Ketercapaian Pembelajaran
                </h3>
                <p className="text-xs text-white/80">
                  Hasil evaluasi singkat pemahaman dan output siswa.
                </p>
              </div>

              {/* Smart Suggestion Chips */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-[#fde047] uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#fde047]" />
                  <span>Saran Ketercapaian:</span>
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto touch-scroll pb-1">
                  {suggestionsHasil.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setHasil(item)}
                      className="suggestion-chip text-left"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-1">
                <textarea
                  rows={3}
                  value={hasil}
                  onChange={e => setHasil(e.target.value)}
                  placeholder="Contoh: Siswa memahami materi dengan baik dan menyelesaikan latihan..."
                  className="w-full bg-white/15 text-white placeholder-white/40 border border-white/20 focus:border-[#fde047] rounded-2xl p-3.5 text-xs font-semibold outline-none resize-none backdrop-blur-sm"
                />
              </div>
            </div>
          )}

          {/* STEP 8: REVIEW & DIGITAL SIGNATURE */}
          {step === 8 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-1">
                <span className="text-[11px] font-extrabold uppercase text-[#fde047] tracking-wider">
                  Langkah Terakhir
                </span>
                <h3 className="text-base font-black text-white">Tinjau & Verifikasi Jurnal LKH</h3>
                <p className="text-xs text-white/80">
                  Pastikan seluruh data aktivitas telah sesuai sebelum disimpan.
                </p>
              </div>

              <div className="bg-white/15 backdrop-blur-md p-4 rounded-3xl space-y-2.5 text-xs text-white border border-white/10">
                <div className="flex justify-between items-center p-2 bg-white/10 rounded-xl">
                  <span className="text-white/70">Tanggal Pelaksanaan</span>
                  <span className="font-extrabold text-white">{tanggal}</span>
                </div>

                <div className="flex justify-between items-center p-2 bg-white/10 rounded-xl">
                  <span className="text-white/70">Klasifikasi Agenda</span>
                  <span className="font-extrabold text-[#fde047]">
                    {isNonKbm ? 'Kegiatan Non-KBM / Dinas Luar' : 'Kegiatan Mengajar (KBM)'}
                  </span>
                </div>

                {!isNonKbm && (
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded-xl">
                    <span className="text-white/70">Mata Pelajaran</span>
                    <span className="font-extrabold text-white">{mapelNama || mapelId}</span>
                  </div>
                )}

                <div className="flex justify-between items-center p-2 bg-white/10 rounded-xl">
                  <span className="text-white/70">Rentang Jam</span>
                  <span className="font-extrabold text-white">
                    {jamMulai ? `Jam ${jamMulai} - ${jamSelesai}` : 'Tanpa Jam / Sehari Penuh'}
                  </span>
                </div>

                {!isNonKbm && (
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded-xl">
                    <span className="text-white/70">Kelas</span>
                    <span className="font-extrabold text-white">{kelas}</span>
                  </div>
                )}

                <div className="p-2 bg-white/10 rounded-xl space-y-1">
                  <span className="text-white/70 block">Uraian Kerja:</span>
                  <p className="font-bold text-white">{uraian}</p>
                </div>

                {!isNonKbm && (
                  <div className="p-2 bg-white/10 rounded-xl space-y-1">
                    <span className="text-white/70 block">Hasil Pembelajaran:</span>
                    <p className="font-bold text-white">{hasil}</p>
                  </div>
                )}

                {/* Digital Signature */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <span className="text-[10px] font-bold text-[#fde047] uppercase block">
                      Paraf Guru
                    </span>
                    <span className="text-[11px] font-bold text-white/80">Otomatis Tersemat</span>
                  </div>
                  <div className="h-12 w-28 bg-white/90 rounded-2xl flex items-center justify-center p-1 shadow-xs">
                    {currentUser?.parafUrl ? (
                      <img
                        src={currentUser.parafUrl}
                        alt="Paraf"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 font-mono">
                        [Paraf Digital]
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center justify-between space-x-2 pt-2">
            {step > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-5 py-3 bg-[#00242c]/90 border border-teal-500/30 hover:bg-[#00242c] text-white font-bold text-xs rounded-2xl shadow-xl active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>
            )}

            <div className="flex-1 flex justify-end">
              {step < 8 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full py-3 bg-[#facc15] hover:bg-[#eab308] text-slate-900 font-black text-xs sm:text-sm rounded-2xl shadow-xl active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Lanjutkan</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitLkh}
                  disabled={submitting}
                  className="w-full py-3 bg-[#facc15] hover:bg-[#eab308] text-slate-900 font-black text-xs sm:text-sm rounded-2xl shadow-xl active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submitting ? 'Menyimpan...' : 'Kirim & Simpan Jurnal LKH'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* HISTORY TAB */
        <div className="bg-white/15 backdrop-blur-xl rounded-3xl p-4 text-white shadow-xl border border-white/15 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <h3 className="text-xs font-bold text-[#fde047] uppercase tracking-wider">
              Riwayat Jurnal LKH Tersimpan
            </h3>
            <span className="text-[11px] font-mono font-bold text-white/80">
              {historyRecords.length} Catatan
            </span>
          </div>

          <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto touch-scroll pr-1">
            {loadingHistory ? (
              <div className="text-center py-12 text-[#fde047] text-xs font-bold shimmer-box">
                Memuat riwayat LKH...
              </div>
            ) : historyRecords.length > 0 ? (
              historyRecords.map((rec, idx) => {
                const recId = rec.LkhID || rec.lkhId || `lkh-${idx}`;
                return (
                  <div
                    key={recId}
                    className="p-3.5 bg-white/10 hover:bg-white/15 rounded-2xl border border-white/10 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#00242c] text-[#facc15] border border-amber-400/40">
                          {rec.Tanggal || rec.tanggal || '-'}
                        </span>
                        <span className="text-xs font-bold text-teal-200">
                          {rec.IsNonKbm || rec.isNonKbm
                            ? 'Non-KBM / Dinas Luar'
                            : `${rec.mapelNama || rec.MataPelajaranID} • Kelas ${rec.Kelas || rec.kelas}`}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteRecord(recId)}
                        className="p-1.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition-all cursor-pointer"
                        title="Hapus Jurnal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-white font-medium">{rec.UraianKerja || rec.uraian}</p>

                    {!(rec.IsNonKbm || rec.isNonKbm) && (
                      <p className="text-[11px] text-teal-200/90 italic">
                        Hasil: {rec.HasilPembelajaran || rec.hasil}
                      </p>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs font-medium">
                Belum ada catatan jurnal LKH yang tersimpan.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
