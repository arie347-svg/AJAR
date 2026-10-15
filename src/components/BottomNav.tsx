import React from 'react';
import { Home, BookOpen, CalendarCheck, Award, FileEdit, FileSpreadsheet, Lock } from 'lucide-react';
import { PageId } from '../types';

interface BottomNavProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  isMasterAjarLocked?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activePage,
  onNavigate,
  isMasterAjarLocked = false,
}) => {
  if (activePage === 'dashboard') {
    return null;
  }

  const items: { id: PageId; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Beranda', icon: Home },
    { id: 'master-ajar', label: 'Ajar', icon: BookOpen },
    { id: 'absensi', label: 'Presensi', icon: CalendarCheck },
    { id: 'nilai', label: 'Nilai', icon: Award },
    { id: 'lkh', label: 'LKH', icon: FileEdit },
    { id: 'laporan', label: 'Laporan', icon: FileSpreadsheet },
  ];

  return (
    <div className="md:hidden fixed bottom-3 left-3 right-3 max-w-md mx-auto z-40 select-none pointer-events-none">
      <nav
        aria-label="Navigasi Bawah"
        className="pointer-events-auto neu-raised-card bg-[#EBF0F8]/95 backdrop-blur-xl border border-white/90 shadow-[0_12px_30px_-5px_rgba(13,22,43,0.18),0_4px_12px_rgba(255,255,255,0.8)] rounded-2xl p-1.5 flex items-center justify-around"
      >
        {items.map(item => {
          const Icon = item.icon;
          const isActive =
            activePage === item.id || (item.id === 'master-ajar' && activePage === 'master-siswa');
          const isItemLocked = isMasterAjarLocked && item.id !== 'master-ajar';

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl transition-all duration-150 cursor-pointer active:scale-95 ${
                isActive
                  ? 'neu-pressed bg-[#E2ECF9] border border-blue-200/70 text-[#2167F3] shadow-inner font-black'
                  : isItemLocked
                  ? 'text-slate-400 opacity-60 hover:opacity-80'
                  : 'text-slate-500 hover:text-slate-800 font-bold hover:bg-white/40'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-150 ${
                    isActive
                      ? 'text-[#2167F3] scale-110 drop-shadow-[0_2px_4px_rgba(33,103,243,0.3)]'
                      : 'text-slate-500'
                  }`}
                />
                {isItemLocked && (
                  <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center text-[8px] shadow-xs">
                    <Lock className="w-2 h-2" />
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-0.5 tracking-tight ${
                  isActive ? 'text-[#0D162B] font-black' : 'text-slate-600 font-semibold'
                }`}
              >
                {item.label}
              </span>

              {/* Indikator titik aktif menyala */}
              {isActive && (
                <span className="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full bg-[#2167F3] shadow-[0_0_6px_#2167F3]" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
