import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, BookOpen, Check, AlertCircle } from 'lucide-react';
import { RefItem } from '../types';

interface NeuMapelModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  accentColor?: 'blue' | 'amber' | 'emerald';
  listMapel: RefItem[];
  selectedMapelId: string;
  onSelect: (mapelId: string, mapelNama: string) => void;
}

export const NeuMapelModal: React.FC<NeuMapelModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle = 'Pilih salah satu mata pelajaran dari kurikulum madrasah',
  accentColor = 'blue',
  listMapel,
  selectedMapelId,
  onSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

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

  // Filter mapel based on search query
  const filteredMapel = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return listMapel;
    return listMapel.filter(item => {
      const name = (item.name || '').toLowerCase();
      const code = (item.code || '').toLowerCase();
      const id = (item.id || '').toLowerCase();
      return name.includes(q) || code.includes(q) || id.includes(q);
    });
  }, [listMapel, searchQuery]);

  if (!isOpen) return null;

  // Accent styling configurations
  const theme = {
    blue: {
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200/80',
      activeCard: 'bg-blue-50/90 text-blue-900 border-blue-400 neu-pressed shadow-inner',
      activeBadge: 'bg-blue-600 text-white',
      checkIcon: 'text-blue-600',
      focusRing: 'focus:border-blue-500 focus:ring-blue-400/20',
      headerIcon: 'bg-blue-50 text-blue-600 border-blue-200',
    },
    amber: {
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200/80',
      activeCard: 'bg-amber-50/90 text-amber-900 border-amber-400 neu-pressed shadow-inner',
      activeBadge: 'bg-amber-600 text-white',
      checkIcon: 'text-amber-600',
      focusRing: 'focus:border-amber-500 focus:ring-amber-400/20',
      headerIcon: 'bg-amber-50 text-amber-600 border-amber-200',
    },
    emerald: {
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      activeCard: 'bg-emerald-50/90 text-emerald-900 border-emerald-400 neu-pressed shadow-inner',
      activeBadge: 'bg-emerald-600 text-white',
      checkIcon: 'text-emerald-600',
      focusRing: 'focus:border-emerald-500 focus:ring-emerald-400/20',
      headerIcon: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    },
  }[accentColor];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="neu-raised-card bg-[#EAF0F9] w-full max-w-lg max-h-[85vh] rounded-3xl p-4 sm:p-5 flex flex-col border border-white/95 shadow-[16px_20px_40px_rgba(160,178,204,0.45),-12px_-12px_32px_rgba(255,255,255,0.95)] animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-[#d4deeb]/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs ${theme.headerIcon}`}
            >
              <BookOpen className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-[#0D162B] truncate tracking-tight">
                {title}
              </h3>
              <p className="text-[11px] font-semibold text-slate-500 truncate">
                {subtitle}
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

        {/* Search Bar Neumorphic Terangkat */}
        <div className="pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari mata pelajaran atau kode..."
              className={`w-full neu-pressed bg-[#E8EEF6] border border-white/70 text-slate-800 font-extrabold text-xs sm:text-sm rounded-2xl pl-10 pr-9 py-2.5 outline-none transition-all placeholder:text-slate-400 placeholder:font-semibold ${theme.focusRing}`}
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
          <div className="flex items-center justify-between px-1 mt-1.5 text-[10px] font-bold text-slate-500">
            <span>Kurikulum Madrasah Resmi</span>
            <span>{filteredMapel.length} Mata Pelajaran</span>
          </div>
        </div>

        {/* List Mata Pelajaran Neumorphic */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-scroll pr-1 space-y-2 mt-1"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#c5d3e5 transparent',
          }}
        >
          {filteredMapel.length === 0 ? (
            <div className="neu-flat bg-[#EBF0F8] rounded-2xl p-6 text-center border border-white/90 my-2 space-y-2">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700">
                Mata pelajaran tidak ditemukan
              </p>
              <p className="text-[11px] text-slate-400">
                Coba gunakan kata kunci pencarian yang lain
              </p>
            </div>
          ) : (
            filteredMapel.map((m, idx) => {
              const val = m.code || m.id || m.name;
              const isSelected = val === selectedMapelId || m.id === selectedMapelId;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onSelect(val, m.name);
                    onClose();
                  }}
                  className={`w-full text-left p-3 rounded-2xl flex items-center justify-between gap-3 transition-all cursor-pointer border active:scale-[0.99] ${
                    isSelected
                      ? theme.activeCard
                      : 'neu-flat bg-[#EBF0F8] text-slate-800 hover:text-slate-900 border-white/90 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0 border ${
                        isSelected ? theme.activeBadge : theme.badgeBg
                      }`}
                    >
                      {m.code || `MP${String(idx + 1).padStart(2, '0')}`}
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold truncate">
                      {m.name}
                    </span>
                  </div>

                  {isSelected && (
                    <div
                      className={`w-6 h-6 rounded-xl flex items-center justify-center shrink-0 shadow-xs bg-white/90 ${theme.checkIcon}`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-[#d4deeb]/70 mt-2 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-semibold">
            Klik mata pelajaran untuk langsung memilih
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl neu-flat active:neu-pressed text-slate-700 text-xs font-bold cursor-pointer transition-all active:scale-95"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
