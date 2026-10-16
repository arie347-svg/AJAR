import React from 'react';
import {
  Home,
  BookOpen,
  Users,
  CalendarCheck,
  Award,
  FileEdit,
  FileSpreadsheet,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { PageId, User } from '../types';
import { AjarBrandLogo } from './AjarBrandLogo';

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  currentUser: User | null;
  onLogout: () => void;
  isMasterAjarLocked?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  currentUser,
  onLogout,
  isMasterAjarLocked = false,
}) => {
  const navItems: { id: PageId; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Beranda', icon: Home },
    { id: 'master-ajar', label: 'Master Ajar', icon: BookOpen },
    { id: 'master-siswa', label: 'Data Siswa', icon: Users },
    { id: 'absensi', label: 'Entri Presensi', icon: CalendarCheck },
    { id: 'nilai', label: 'Input Nilai', icon: Award },
    { id: 'lkh', label: 'Jurnal LKH', icon: FileEdit },
    { id: 'laporan', label: 'Export Laporan', icon: FileSpreadsheet },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-[#EEF2F6] border-r border-[#d4deeb] text-slate-800 shrink-0 z-30 select-none justify-between h-full p-4 overflow-y-auto no-scrollbar shadow-[4px_0_16px_rgba(166,180,209,0.22)]">
      <div className="space-y-5">
        {/* Brand header Light Neumorphic dengan Logo Squircle persis halaman Login */}
        <div className="flex items-center space-x-3 px-1 pt-1 pb-1">
          <div className="neu-logo-tile w-12 h-12 rounded-[18px] flex items-center justify-center p-2 shrink-0 transition-transform duration-200 hover:scale-[1.03]">
            <AjarBrandLogo idPrefix="sidebar" className="w-8 h-8" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-black tracking-wider text-[#0D162B] leading-none">AJAR</h2>
            <p className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider mt-1 truncate">
              MAN 1 Majalengka
            </p>
          </div>
        </div>

        {/* Navigation list dengan gaya Tactile Soft UI */}
        <nav className="space-y-1.5">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            const isItemLocked = isMasterAjarLocked && item.id !== 'master-ajar';
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                disabled={isItemLocked}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs transition-all cursor-pointer ${
                  isActive
                    ? 'neu-inset bg-[#E4ECF6] text-[#0D162B] font-black border border-blue-300/40 shadow-inner'
                    : isItemLocked
                    ? 'text-slate-400 opacity-60 cursor-not-allowed bg-transparent'
                    : 'neu-flat bg-[#EEF2F6] hover:bg-[#F3F7FC] text-slate-600 hover:text-[#0D162B] font-bold border border-white/80 active:scale-[0.99]'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isActive
                        ? 'neu-pressed bg-[#DCE6F3] text-blue-700 shadow-inner'
                        : 'text-slate-500'
                    }`}
                  >
                    <Icon className="w-4 h-4 stroke-[2.4]" />
                  </div>
                  <span className="truncate">{item.label}</span>
                </div>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 shadow-xs" />
                )}
                {isItemLocked && (
                  <span className="text-[10px] font-mono text-slate-400 neu-inset px-2 py-0.5 rounded-lg bg-[#E8EEF6]">
                    Terkunci
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer User Info & Logout */}
      <div className="pt-4 border-t border-[#d4deeb] space-y-2">
        <div
          onClick={() => onNavigate('profil')}
          className="flex items-center space-x-3 p-2.5 rounded-2xl neu-raised-card bg-[#EEF2F6] hover:bg-[#F3F7FC] cursor-pointer active:scale-98 transition-all border border-white/90 shadow-sm"
          title="Buka Profil Guru"
        >
          {currentUser?.fotoUrl ? (
            <img
              src={currentUser.fotoUrl}
              alt="Avatar"
              className="w-9 h-9 rounded-full object-cover ring-2 ring-blue-500/30 shrink-0 shadow-sm"
            />
          ) : (
            <div className="w-9 h-9 rounded-full neu-inset bg-[#E8EEF6] ring-2 ring-blue-500/20 flex items-center justify-center shrink-0 text-blue-700">
              <UserIcon className="w-5 h-5 stroke-[2.2]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-[#0D162B] truncate">
              {currentUser?.namaTampilan || currentUser?.namaLengkap || 'Guru'}
            </p>
            <p className="text-[10px] text-slate-500 font-mono font-bold truncate">
              NIP. {currentUser?.nip || '-'}
            </p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl neu-btn bg-[#EEF2F6] hover:bg-rose-50 text-rose-600 hover:text-rose-700 text-xs font-bold active:scale-95 transition-all border border-rose-200/50 cursor-pointer shadow-xs"
        >
          <LogOut className="w-4 h-4 stroke-[2.2]" />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
};
