import React from 'react';
import {
  Calendar,
  GraduationCap,
  BookMarked,
  Users,
  FileEdit,
  BookOpen,
  CalendarCheck,
  Award,
  FileSpreadsheet,
  User as UserIcon,
} from 'lucide-react';
import { DashboardData, PageId, User } from '../types';

interface DashboardProps {
  currentUser: User | null;
  data: DashboardData;
  onNavigate: (page: PageId) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, data, onNavigate }) => {
  const quickActions = [
    {
      id: 'master-ajar' as PageId,
      label: 'Master Ajar',
      sub: 'Kurikulum',
      icon: BookOpen,
      iconBg: 'bg-blue-50 border-blue-200/70 text-[#1E5CD9]',
    },
    {
      id: 'master-siswa' as PageId,
      label: 'Data Siswa',
      sub: 'Daftar Kelas',
      icon: Users,
      iconBg: 'bg-emerald-50 border-emerald-200/70 text-[#059669]',
    },
    {
      id: 'absensi' as PageId,
      label: 'Presensi',
      sub: 'Kehadiran',
      icon: CalendarCheck,
      iconBg: 'bg-amber-50 border-amber-200/70 text-[#D97706]',
    },
    {
      id: 'nilai' as PageId,
      label: 'Penilaian',
      sub: 'Input Nilai',
      icon: Award,
      iconBg: 'bg-purple-50 border-purple-200/70 text-[#7C3AED]',
    },
    {
      id: 'lkh' as PageId,
      label: 'Jurnal LKH',
      sub: 'Aktivitas Guru',
      icon: FileEdit,
      iconBg: 'bg-sky-50 border-sky-200/70 text-[#0284C7]',
    },
    {
      id: 'laporan' as PageId,
      label: 'Laporan',
      sub: 'Export Rekap',
      icon: FileSpreadsheet,
      iconBg: 'bg-rose-50 border-rose-200/70 text-[#E11D48]',
    },
  ];

  return (
    <div className="h-full w-full flex flex-col justify-between gap-2.5 sm:gap-3 text-slate-800 select-none overflow-hidden antialiased">
      {/* Hero Welcome Card - Neumorphic High Contrast Royal Blue with Soft Specular Lighting */}
      <div className="rounded-[26px] p-3.5 sm:p-4 bg-gradient-to-br from-[#1A56DB] via-[#2167F3] to-[#1244A8] border border-white/30 shrink-0 relative overflow-hidden shadow-[-6px_-6px_16px_rgba(255,255,255,0.9),_8px_10px_24px_rgba(20,73,184,0.45),_inset_1.5px_1.5px_3px_rgba(255,255,255,0.35)] text-white">
        {/* Soft Decorative Ambient Neumorphic Rings */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full border-[10px] border-white/15 blur-[0.5px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-10 -left-6 w-28 h-28 rounded-full bg-white/10 blur-xl"
        />

        <div className="relative z-10 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-100/90 block">
              Selamat Datang,
            </span>
            <h2 className="text-sm sm:text-base font-black text-white truncate tracking-tight mt-0.5 drop-shadow-xs">
              {currentUser?.namaTampilan || currentUser?.namaLengkap || 'Guru'}
            </h2>
            <p className="text-[10px] text-blue-100/80 font-semibold truncate mt-0.5">
              {currentUser?.jabatan || 'MAN 1 Majalengka'}
            </p>
          </div>

          {/* Profile Avatar Button - Debossed Inset Well with Status Dot */}
          <button
            onClick={() => onNavigate('profil')}
            className="cursor-pointer active:scale-95 transition-all shrink-0 relative p-1 rounded-full bg-white/20 border border-white/40 shadow-[inset_2px_2px_4px_rgba(10,35,90,0.3),_inset_-2px_-2px_4px_rgba(255,255,255,0.4)] hover:bg-white/30 backdrop-blur-xs"
            title="Buka Profil Guru"
          >
            {currentUser?.fotoUrl ? (
              <img
                src={currentUser.fotoUrl}
                alt="Avatar"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover shadow-xs border border-white/80"
              />
            ) : (
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white text-[#1A56DB] flex items-center justify-center shadow-inner font-black text-sm">
                <UserIcon className="w-5 h-5 stroke-[2.3]" />
              </div>
            )}
            <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#1A56DB]" />
          </button>
        </div>

        {/* Quick Fill LKH Button - Tactile Neumorphic White Slab Button */}
        <button
          onClick={() => onNavigate('lkh')}
          className="w-full mt-2.5 sm:mt-3 bg-gradient-to-b from-[#FFFFFF] to-[#F1F5F9] border border-white shadow-[3px_5px_12px_rgba(10,35,90,0.3),_-2px_-2px_6px_rgba(255,255,255,0.85),_inset_0_1px_2px_rgba(255,255,255,0.9)] active:shadow-[inset_2px_2px_5px_rgba(10,35,90,0.25)] active:scale-[0.99] text-[#1A56DB] font-black text-xs py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <FileEdit className="w-4 h-4 text-[#1A56DB] stroke-[2.4]" />
          <span>Isi Jurnal LKH</span>
        </button>
      </div>

      {/* 4 KPI Cards in 2x2 Grid - Authentic Neumorphic Surfaces with Thematic Pastel Accents */}
      <div className="grid grid-cols-2 gap-2 sm:gap-2.5 shrink-0">
        {/* KPI 1: Tahun Ajaran (Biru) */}
        <div className="neu-flat rounded-2xl p-2.5 sm:p-3 flex items-center justify-between bg-gradient-to-br from-[#EBF0F8] via-[#EBF3FC] to-[#DEECFA] border border-white/90 shadow-[-5px_-5px_12px_rgba(255,255,255,0.95),_6px_6px_14px_rgba(166,180,209,0.4)]">
          <div className="min-w-0 pr-1">
            <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block truncate">
              Tahun Ajaran
            </span>
            <p className="text-xs sm:text-sm font-black text-[#0D162B] tracking-tight truncate mt-0.5">
              {data.tahunAjaran || '2026/2027'}
            </p>
          </div>
          <div className="w-8 h-8 rounded-xl neu-pressed flex items-center justify-center text-[#1E5CD9] shrink-0 border border-blue-200/50">
            <Calendar className="w-4 h-4 stroke-[2.3]" />
          </div>
        </div>

        {/* KPI 2: Total Kelas (Indigo / Ungu) */}
        <div className="neu-flat rounded-2xl p-2.5 sm:p-3 flex items-center justify-between bg-gradient-to-br from-[#EBF0F8] via-[#ECEEFC] to-[#E0E4FA] border border-white/90 shadow-[-5px_-5px_12px_rgba(255,255,255,0.95),_6px_6px_14px_rgba(166,180,209,0.4)]">
          <div className="min-w-0 pr-1">
            <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider block truncate">
              Total Kelas
            </span>
            <p className="text-xs sm:text-sm font-black text-[#0D162B] tracking-tight truncate mt-0.5">
              {data.totalKelas || 0}
            </p>
          </div>
          <div className="w-8 h-8 rounded-xl neu-pressed flex items-center justify-center text-[#4F46E5] shrink-0 border border-indigo-200/50">
            <GraduationCap className="w-4 h-4 stroke-[2.3]" />
          </div>
        </div>

        {/* KPI 3: Total Mapel (Hijau Zamrud) */}
        <div className="neu-flat rounded-2xl p-2.5 sm:p-3 flex items-center justify-between bg-gradient-to-br from-[#EBF0F8] via-[#EBF9F3] to-[#DEF4E9] border border-white/90 shadow-[-5px_-5px_12px_rgba(255,255,255,0.95),_6px_6px_14px_rgba(166,180,209,0.4)]">
          <div className="min-w-0 pr-1">
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block truncate">
              Mata Pelajaran
            </span>
            <p className="text-xs sm:text-sm font-black text-[#0D162B] tracking-tight truncate mt-0.5">
              {data.totalMapel || 0}
            </p>
          </div>
          <div className="w-8 h-8 rounded-xl neu-pressed flex items-center justify-center text-[#059669] shrink-0 border border-emerald-200/50">
            <BookMarked className="w-4 h-4 stroke-[2.3]" />
          </div>
        </div>

        {/* KPI 4: Total Siswa (Oranye / Amber) */}
        <div className="neu-flat rounded-2xl p-2.5 sm:p-3 flex items-center justify-between bg-gradient-to-br from-[#EBF0F8] via-[#FDF5EB] to-[#FAEBDA] border border-white/90 shadow-[-5px_-5px_12px_rgba(255,255,255,0.95),_6px_6px_14px_rgba(166,180,209,0.4)]">
          <div className="min-w-0 pr-1">
            <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider block truncate">
              Total Siswa
            </span>
            <p className="text-xs sm:text-sm font-black text-[#0D162B] tracking-tight truncate mt-0.5">
              {data.totalSiswa || 0}
            </p>
          </div>
          <div className="w-8 h-8 rounded-xl neu-pressed flex items-center justify-center text-[#D97706] shrink-0 border border-amber-200/50">
            <Users className="w-4 h-4 stroke-[2.3]" />
          </div>
        </div>
      </div>

      {/* Quick Access Module Section - Neumorphic Elevated Container */}
      <div className="flex-1 min-h-0 flex flex-col neu-raised-card rounded-[26px] p-3 sm:p-3.5 bg-[#EBF0F8] border border-white/85 shadow-[-6px_-6px_16px_rgba(255,255,255,0.95),_8px_8px_20px_rgba(166,180,209,0.42)]">
        <div className="flex items-center justify-between mb-2 shrink-0 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-3.5 bg-gradient-to-b from-[#1E5CD9] to-[#1244A8] rounded-full shadow-[0_0_8px_rgba(30,92,217,0.4)]" />
            <h3 className="text-xs font-black text-[#0D162B] tracking-tight uppercase">
              Akses Cepat
            </h3>
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            6 Modul
          </span>
        </div>

        {/* 3x2 Grid: Vertical scroll only if needed, with no-scrollbar */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar overscroll-contain">
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
            {quickActions.map(action => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => onNavigate(action.id)}
                  className="neu-flat hover:neu-pressed active:neu-pressed rounded-2xl p-2.5 sm:p-3 flex flex-col items-center justify-center text-center transition-all cursor-pointer group border border-white/80 active:scale-95"
                  title={`Buka ${action.label}`}
                >
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl neu-pressed flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105 border border-white/70 ${action.iconBg}`}
                  >
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.3]" />
                  </div>
                  <span className="text-[11px] font-black text-[#0D162B] tracking-tight leading-tight line-clamp-1 group-hover:text-[#1E5CD9] transition-colors">
                    {action.label}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-500 mt-0.5 leading-none">
                    {action.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
