import React, { useState, useMemo } from 'react';
import { RefItem } from '../types';
import { Check, Layers } from 'lucide-react';

export type TingkatGrade = 'X' | 'XI' | 'XII' | 'OTHER';

export const classifyGrade = (className: string): TingkatGrade => {
  let clean = (className || '').trim().toUpperCase();
  // Bersihkan prefix kata seperti "KELAS ", "KLS ", "GRADE "
  clean = clean.replace(/^(KELAS|KLS|GRADE)\s+/i, '');

  // 1. Cek ketat awalan XII (Dua Belas) atau 12 di awal nama kelas
  // Hanya cocok jika diawali XII/12 diikuti pemisah (titik/strip/spasi/akhir kalimat)
  // TIDAK menggunakan .includes('12') agar X.12 dan XI.12 TIDAK pernah masuk ke XII
  if (/^(XII\b|XII[.\-_\s]|XII$|12\b|12[.\-_\s])/.test(clean)) {
    return 'XII';
  }

  // 2. Cek ketat awalan XI (Sebelas) atau 11 di awal nama kelas
  if (/^(XI\b|XI[.\-_\s]|XI$|11\b|11[.\-_\s])/.test(clean)) {
    return 'XI';
  }

  // 3. Cek ketat awalan X (Sepuluh) atau 10 di awal nama kelas
  if (/^(X\b|X[.\-_\s]|X$|10\b|10[.\-_\s])/.test(clean)) {
    return 'X';
  }

  // 4. Fallback jika nama diawali penanda khusus namun ada kata XII / XI / X terpisah batas kata
  if (/\bXII\b/.test(clean)) return 'XII';
  if (/\bXI\b/.test(clean)) return 'XI';
  if (/\bX\b/.test(clean)) return 'X';

  return 'OTHER';
};

interface NeuClassSelectorProps {
  listKelas: RefItem[];
  selectedKelases: string[];
  onToggleClass: (kVal: string) => void;
  accentColor?: 'blue' | 'amber' | 'emerald';
}

export const NeuClassSelector: React.FC<NeuClassSelectorProps> = ({
  listKelas,
  selectedKelases,
  onToggleClass,
  accentColor = 'blue',
}) => {
  // Determine if there are 'OTHER' classes in reference
  const hasOtherClasses = useMemo(() => {
    return listKelas.some(k => classifyGrade(k.name || k.code || '') === 'OTHER');
  }, [listKelas]);

  // Initial tab: detect if user already has selected classes in XI or XII, or default to X
  const defaultTab = useMemo<TingkatGrade>(() => {
    if (selectedKelases.length > 0) {
      const firstSelected = selectedKelases[0];
      const g = classifyGrade(firstSelected);
      if (g === 'XI' || g === 'XII' || g === 'X') return g;
    }
    return 'X';
  }, [selectedKelases]);

  const [activeGrade, setActiveGrade] = useState<TingkatGrade>(defaultTab);

  // Group classes by grade
  const classesByGrade = useMemo(() => {
    const map: Record<TingkatGrade, RefItem[]> = {
      X: [],
      XI: [],
      XII: [],
      OTHER: [],
    };
    listKelas.forEach(k => {
      const grade = classifyGrade(k.name || k.code || '');
      map[grade].push(k);
    });
    return map;
  }, [listKelas]);

  // Current classes for active grade
  const currentGradeClasses = classesByGrade[activeGrade] || [];

  // Count selected in active grade
  const activeGradeSelectedCount = useMemo(() => {
    return currentGradeClasses.filter(k => {
      const val = k.code || k.id || k.name;
      return selectedKelases.includes(val);
    }).length;
  }, [currentGradeClasses, selectedKelases]);

  // Total selected count overall
  const totalSelectedCount = selectedKelases.length;

  // Batch toggle all classes in active grade
  const handleToggleAllCurrentGrade = () => {
    const currentGradeVals = currentGradeClasses.map(k => k.code || k.id || k.name);
    const areAllSelected = currentGradeVals.every(val => selectedKelases.includes(val));

    currentGradeVals.forEach(val => {
      const isCurrentlySelected = selectedKelases.includes(val);
      if (areAllSelected) {
        // Deselect all in this grade
        if (isCurrentlySelected) {
          onToggleClass(val);
        }
      } else {
        // Select all in this grade
        if (!isCurrentlySelected) {
          onToggleClass(val);
        }
      }
    });
  };

  // Color styles configuration
  const theme = {
    blue: {
      activeTab: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25',
      activeChip: 'bg-blue-50 text-blue-900 border-blue-400/90 neu-pressed shadow-inner',
      checkBg: 'bg-blue-600 text-white',
      badgeText: 'text-blue-700',
      actionText: 'text-blue-600 hover:text-blue-800',
    },
    amber: {
      activeTab: 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-500/25',
      activeChip: 'bg-amber-50 text-amber-900 border-amber-400/90 neu-pressed shadow-inner',
      checkBg: 'bg-amber-600 text-white',
      badgeText: 'text-amber-700',
      actionText: 'text-amber-600 hover:text-amber-800',
    },
    emerald: {
      activeTab: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25',
      activeChip: 'bg-emerald-50 text-emerald-900 border-emerald-400/90 neu-pressed shadow-inner',
      checkBg: 'bg-emerald-600 text-white',
      badgeText: 'text-emerald-700',
      actionText: 'text-emerald-600 hover:text-emerald-800',
    },
  }[accentColor];

  const tabs: { grade: TingkatGrade; label: string; desc: string }[] = [
    { grade: 'X', label: 'X (Sepuluh)', desc: 'Kelas 10' },
    { grade: 'XI', label: 'XI (Sebelas)', desc: 'Kelas 11' },
    { grade: 'XII', label: 'XII (Dua Belas)', desc: 'Kelas 12' },
  ];

  if (hasOtherClasses) {
    tabs.push({ grade: 'OTHER', label: 'Lainnya', desc: 'Rombel Lain' });
  }

  return (
    <div className="space-y-2">
      {/* 1. Header Tingkatan & Ringkasan */}
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <span>Pilih Tingkatan Kelas Ajar:</span>
        </label>
        <span className={`text-[10px] font-black ${theme.badgeText}`}>
          Total {totalSelectedCount} Kelas Dipilih
        </span>
      </div>

      {/* 2. Tabs Filter Tingkatan X, XI, XII */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl neu-pressed bg-[#E8EEF6]">
        {tabs.map(t => {
          const isActive = activeGrade === t.grade;
          const countInGrade = (classesByGrade[t.grade] || []).length;
          const countSelectedInGrade = (classesByGrade[t.grade] || []).filter(k => {
            const val = k.code || k.id || k.name;
            return selectedKelases.includes(val);
          }).length;

          return (
            <button
              key={t.grade}
              type="button"
              onClick={() => setActiveGrade(t.grade)}
              className={`py-2 px-1.5 rounded-xl text-center transition-all cursor-pointer select-none active:scale-95 ${
                isActive
                  ? `${theme.activeTab} font-black`
                  : 'neu-flat bg-[#EBF0F8] text-slate-700 hover:text-slate-900 border border-white/80 font-bold'
              }`}
            >
              <div className="text-[11px] sm:text-xs leading-tight font-extrabold">
                {t.label}
              </div>
              <div
                className={`text-[9px] mt-0.5 font-bold ${
                  isActive ? 'text-white/80' : 'text-slate-400'
                }`}
              >
                {countSelectedInGrade > 0 ? (
                  <span className={isActive ? 'text-white font-black' : 'text-blue-600 font-black'}>
                    {countSelectedInGrade}/{countInGrade} Dipilih
                  </span>
                ) : (
                  `${countInGrade} Rombel`
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Sub-header untuk daftar kelas di tingkat terpilih */}
      <div className="flex items-center justify-between px-1 text-[10px] font-bold text-slate-500">
        <span>
          Daftar Rombel Tingkat {activeGrade}: ({currentGradeClasses.length} Kelas)
        </span>
        {currentGradeClasses.length > 0 && (
          <button
            type="button"
            onClick={handleToggleAllCurrentGrade}
            className={`cursor-pointer underline font-extrabold transition-colors ${theme.actionText}`}
          >
            {activeGradeSelectedCount === currentGradeClasses.length
              ? 'Batal Semua Tingkat Ini'
              : 'Pilih Semua Tingkat Ini'}
          </button>
        )}
      </div>

      {/* 4. Daftar Kelas HANYA untuk tingkatan yang dipilih */}
      <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-2 neu-pressed bg-[#E8EEF6] rounded-2xl touch-scroll">
        {currentGradeClasses.length === 0 ? (
          <div className="col-span-2 py-4 text-center text-xs font-semibold text-slate-400">
            Tidak ada rombel untuk tingkatan {activeGrade} di referensi madrasah
          </div>
        ) : (
          currentGradeClasses.map((k, i) => {
            const val = k.code || k.id || k.name;
            const isChecked = selectedKelases.includes(val);

            return (
              <button
                key={i}
                type="button"
                onClick={() => onToggleClass(val)}
                className={`p-2.5 rounded-xl text-xs font-extrabold text-left transition-all flex items-center justify-between gap-1.5 cursor-pointer active:scale-95 ${
                  isChecked
                    ? `${theme.activeChip} border`
                    : 'neu-flat bg-[#EBF0F8] text-slate-700 hover:text-slate-900 border border-white/90 shadow-xs'
                }`}
              >
                <span className="truncate">{k.name}</span>
                <span
                  className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 text-[10px] transition-all ${
                    isChecked
                      ? `${theme.checkBg} shadow-xs font-black`
                      : 'neu-pressed border border-[#d4deeb] bg-[#e4ecf7]'
                  }`}
                >
                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
