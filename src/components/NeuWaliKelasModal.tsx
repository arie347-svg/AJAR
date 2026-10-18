import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Users, Check, GraduationCap, AlertCircle } from 'lucide-react';
import { RefItem } from '../types';
import { TingkatGrade, classifyGrade } from './NeuClassSelector';

interface NeuWaliKelasModalProps {
  isOpen: boolean;
  onClose: () => void;
  listKelas: RefItem[];
  currentWaliKelas: string;
  onSelectWaliKelas: (val: string) => void;
}

export const NeuWaliKelasModal: React.FC<NeuWaliKelasModalProps> = ({
  isOpen,
  onClose,
  listKelas,
  currentWaliKelas,
  onSelectWaliKelas,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Group classes by grade
  const classesByGrade = useMemo(() => {
    const map: Record<TingkatGrade, RefItem[]> = {
      X: [],
      XI: [],
      XII: [],
      OTHER: [],
    };
    listKelas.forEach(k => {
      const g = classifyGrade(k.name || k.code || '');
      map[g].push(k);
    });
    return map;
  }, [listKelas]);

  // Determine initial active grade based on current assignment
  const initialGrade = useMemo<TingkatGrade>(() => {
    if (currentWaliKelas && currentWaliKelas !== 'Bukan Wali Kelas') {
      const g = classifyGrade(currentWaliKelas);
      if (g === 'X' || g === 'XI' || g === 'XII') return g;
    }
    return 'X';
  }, [currentWaliKelas]);

  const [activeGrade, setActiveGrade] = useState<TingkatGrade>(initialGrade);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      if (currentWaliKelas && currentWaliKelas !== 'Bukan Wali Kelas') {
        const g = classifyGrade(currentWaliKelas);
        if (g === 'X' || g === 'XI' || g === 'XII') {
          setActiveGrade(g);
        }
      }
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, currentWaliKelas]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filter classes in active grade
  const currentGradeClasses = useMemo(() => {
    const baseList = classesByGrade[activeGrade] || [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return baseList;
    return baseList.filter(k => {
      const name = (k.name || '').toLowerCase();
      const code = (k.code || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [classesByGrade, activeGrade, searchQuery]);

  const isBukanWaliSelected = currentWaliKelas === 'Bukan Wali Kelas';

  if (!isOpen) return null;

  const tabs: { grade: TingkatGrade; label: string }[] = [
    { grade: 'X', label: 'X (Sepuluh)' },
    { grade: 'XI', label: 'XI (Sebelas)' },
    { grade: 'XII', label: 'XII (Dua Belas)' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="neu-raised-card bg-[#EAF0F9] w-full max-w-lg max-h-[90vh] rounded-3xl p-4 sm:p-5 flex flex-col border border-white/95 shadow-[16px_20px_40px_rgba(160,178,204,0.45),-12px_-12px_32px_rgba(255,255,255,0.95)] animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-[#d4deeb]/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0 shadow-xs">
              <Users className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-[#0D162B] truncate tracking-tight">
                Penugasan Wali Kelas
              </h3>
              <p className="text-[11px] font-semibold text-slate-500 truncate">
                Pilih opsi bukan wali kelas atau pilih kelas binaan
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl neu-flat active:neu-pressed text-slate-500 hover:text-slate-800 border border-white/90 flex items-center justify-center shrink-0 active:scale-95 transition-all cursor-pointer shadow-xs"
            title="Tutup dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-scroll pr-1 space-y-3.5 my-3"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#c5d3e5 transparent',
          }}
        >
          {/* 1. KARTU NEUMORPHIC KHUSUS: BUKAN WALI KELAS */}
          <div>
            <button
              type="button"
              onClick={() => {
                onSelectWaliKelas('Bukan Wali Kelas');
                onClose();
              }}
              className={`w-full p-4 rounded-2xl text-center transition-all cursor-pointer border flex flex-col items-center justify-center space-y-2 select-none active:scale-[0.99] ${
                isBukanWaliSelected
                  ? 'bg-emerald-50/90 text-emerald-900 border-emerald-400 neu-pressed shadow-inner'
                  : 'neu-flat bg-[#EBF0F8] text-slate-800 hover:text-slate-900 border-white/90 shadow-xs'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs ${
                  isBukanWaliSelected
                    ? 'bg-emerald-600 text-white'
                    : 'neu-pressed bg-[#E8EEF6] text-emerald-600'
                }`}
              >
                <GraduationCap className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-sm font-black text-[#0D162B]">
                    Bukan Wali Kelas
                  </span>
                  {isBukanWaliSelected && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                      Aktif Dipilih
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-0.5 font-medium">
                  Bertugas hanya sebagai guru mata pelajaran tanpa binaan rombel
                </p>
              </div>
            </button>
          </div>

          {/* Divider Pemisah */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-[#d4deeb]/80 w-full" />
            <span className="bg-[#EAF0F9] px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">
              Atau Pilih Kelas Binaan
            </span>
          </div>

          {/* 2. TAB FILTER TINGKATAN X, XI, XII */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-extrabold text-slate-700 block">
              Pilih Tingkatan Kelas Binaan:
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl neu-pressed bg-[#E8EEF6]">
              {tabs.map(t => {
                const isActive = activeGrade === t.grade;
                const countInGrade = (classesByGrade[t.grade] || []).length;
                return (
                  <button
                    key={t.grade}
                    type="button"
                    onClick={() => setActiveGrade(t.grade)}
                    className={`py-2 px-1.5 rounded-xl text-center transition-all cursor-pointer select-none active:scale-95 ${
                      isActive
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black shadow-md shadow-emerald-500/25'
                        : 'neu-flat bg-[#EBF0F8] text-slate-700 hover:text-slate-900 border border-white/80 font-bold'
                    }`}
                  >
                    <div className="text-[11px] sm:text-xs font-extrabold leading-tight">
                      {t.label}
                    </div>
                    <div
                      className={`text-[9px] mt-0.5 font-bold ${
                        isActive ? 'text-white/80' : 'text-slate-400'
                      }`}
                    >
                      {countInGrade} Rombel
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. SEARCH BAR TERANGKAT */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Cari rombel tingkat ${activeGrade}...`}
              className="w-full neu-pressed bg-[#E8EEF6] border border-white/70 text-slate-800 font-extrabold text-xs sm:text-sm rounded-2xl pl-10 pr-9 py-2.5 outline-none focus:border-emerald-500 focus:ring-emerald-400/20 transition-all placeholder:text-slate-400 placeholder:font-semibold"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded-full"
                title="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 4. LIST KELAS TINGKATAN AKTIF */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 px-1">
              <span>Rombel Tingkat {activeGrade}:</span>
              <span>{currentGradeClasses.length} Tersedia</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {currentGradeClasses.length === 0 ? (
                <div className="col-span-2 neu-flat bg-[#EBF0F8] rounded-2xl p-4 text-center border border-white/90 space-y-1">
                  <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">
                    Kelas tidak ditemukan
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Tidak ada rombel tingkat {activeGrade} yang cocok
                  </p>
                </div>
              ) : (
                currentGradeClasses.map((k, idx) => {
                  const val = k.code || k.id || k.name;
                  const isSelected = currentWaliKelas === val;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        onSelectWaliKelas(val);
                        onClose();
                      }}
                      className={`p-3 rounded-2xl text-left transition-all cursor-pointer border flex items-center justify-between gap-2 active:scale-95 ${
                        isSelected
                          ? 'bg-emerald-50/90 text-emerald-900 border-emerald-400 neu-pressed shadow-inner'
                          : 'neu-flat bg-[#EBF0F8] text-slate-800 hover:text-slate-900 border-white/90 shadow-xs'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="text-[9px] font-extrabold uppercase text-emerald-700 block">
                          Wali Kelas
                        </span>
                        <span className="text-xs font-black truncate block mt-0.5">
                          {k.name}
                        </span>
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#d4deeb]/70 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-semibold truncate pr-2">
            Status: {currentWaliKelas || 'Bukan Wali Kelas'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl neu-flat active:neu-pressed text-slate-700 text-xs font-bold cursor-pointer transition-all active:scale-95"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
