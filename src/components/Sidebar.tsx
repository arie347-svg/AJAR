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
    <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-[#001c24]/95 backdrop-blur-2xl border-r border-teal-500/20 text-white shrink-0 z-30 select-none justify-between h-full p-4 overflow-y-auto no-scrollbar">
      <div className="space-y-6">
        {/* Brand header */}
        <div className="flex items-center space-x-3 px-2 pt-1">
          <div className="relative w-11 h-11 rounded-2xl bg-white/10 p-1.5 flex items-center justify-center shrink-0 border border-teal-400/30 shadow-md">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/9/9c/Logo_Kemenag.png"
              alt="AJAR"
              className="w-8 h-8 object-contain"
            />
          </div>
          <div>
            <h2 className="text-base font-black tracking-wider text-white">AJAR</h2>
            <p className="text-[10px] font-bold text-[#fde047] uppercase tracking-wider">
              MAN 1 Majalengka
            </p>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="space-y-1.5">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            const isItemLocked = isMasterAjarLocked && item.id !== 'master-ajar';
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-[#facc15] text-slate-900 font-black shadow-md'
                    : isItemLocked
                    ? 'text-white/40 cursor-not-allowed hover:bg-white/5'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-slate-900' : 'text-teal-300'}`} />
                  <span>{item.label}</span>
                </div>
                {isItemLocked && (
                  <span className="text-[10px] font-mono text-white/50 bg-black/20 px-2 py-0.5 rounded-lg">
                    Terkunci
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer User Info & Logout */}
      <div className="pt-4 border-t border-teal-500/20 space-y-2">
        <div
          onClick={() => onNavigate('profil')}
          className="flex items-center space-x-3 p-2.5 rounded-2xl bg-white/10 hover:bg-white/15 cursor-pointer active:scale-98 transition-all border border-white/10"
          title="Buka Profil Guru"
        >
          {currentUser?.fotoUrl ? (
            <img
              src={currentUser.fotoUrl}
              alt="Avatar"
              className="w-9 h-9 rounded-full object-cover ring-2 ring-[#fde047]/60 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-teal-800/80 ring-2 ring-[#fde047]/60 flex items-center justify-center shrink-0 text-[#fde047]">
              <UserIcon className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-white truncate">
              {currentUser?.namaTampilan || currentUser?.namaLengkap || 'Guru'}
            </p>
            <p className="text-[10px] text-white/70 font-mono truncate">
              NIP. {currentUser?.nip || '-'}
            </p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold active:scale-95 transition-all border border-rose-400/20 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
};
