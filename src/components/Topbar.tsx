import React, { useState } from 'react';
import { ArrowLeft, LogOut } from 'lucide-react';
import { PageId } from '../types';
import { GasConnectionInfo } from '../services/gasApi';

interface TopbarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  onLogout: () => void;
  gasConnection?: GasConnectionInfo | null;
}

export const Topbar: React.FC<TopbarProps> = ({ activePage, onNavigate, onLogout, gasConnection }) => {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const titleMap: Record<PageId, string> = {
    dashboard: 'Dashboard',
    profil: 'Profil Guru',
    'master-ajar': 'Master Ajar',
    'master-siswa': 'Data Siswa',
    absensi: 'Presensi Siswa',
    nilai: 'Penilaian Siswa',
    lkh: 'Jurnal LKH',
    laporan: 'Export Laporan',
  };

  const isDashboard = activePage === 'dashboard';
  const isMasterAjar = activePage === 'master-ajar';
  const isProfil = activePage === 'profil';
  const isMasterSiswa = activePage === 'master-siswa';
  const isAbsensi = activePage === 'absensi';
  const isSoftTheme = true;

  return (
    <>
      <header
        className="safe-top-padding px-4 pb-3 flex items-center justify-between sticky top-0 z-30 transition-colors select-none bg-[#EBF0F8]/95 backdrop-blur-xl border-b border-[#d4deeb] shadow-xs text-slate-800"
      >
        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
          {!isDashboard && !isMasterAjar && !isProfil && !isMasterSiswa && !isAbsensi && (
            <button
              onClick={() => onNavigate('dashboard')}
              className="flex items-center justify-center p-2 rounded-xl neu-btn text-slate-700 active:scale-95 transition-all shadow-xs cursor-pointer shrink-0"
              title="Kembali ke Beranda"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          {isDashboard ? (
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-[#0D162B] tracking-tight leading-none">
                AJAR
              </h1>
              <p className="text-[11px] font-normal text-slate-500 tracking-tight mt-0.5 truncate">
                Administrasi &amp; Jurnal Aktivitas Mengajar
              </p>
            </div>
          ) : isMasterAjar ? (
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-[#0D162B] tracking-tight leading-none">
                Master ajar
              </h1>
              <p className="text-[11px] font-normal text-slate-500 tracking-tight mt-0.5 truncate">
                MAN 1 Majalengka
              </p>
            </div>
          ) : isProfil ? (
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-[#0D162B] tracking-tight leading-none">
                Profil Guru
              </h1>
              <p className="text-[11px] font-normal text-slate-500 tracking-tight mt-0.5 truncate">
                MAN 1 Majalengka
              </p>
            </div>
          ) : isMasterSiswa ? (
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-[#0D162B] tracking-tight leading-none">
                Data Siswa
              </h1>
              <p className="text-[11px] font-normal text-slate-500 tracking-tight mt-0.5 truncate">
                MAN 1 Majalengka
              </p>
            </div>
          ) : isAbsensi ? (
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-[#0D162B] tracking-tight leading-none">
                Presensi Siswa
              </h1>
              <p className="text-[11px] font-normal text-slate-500 tracking-tight mt-0.5 truncate">
                MAN 1 Majalengka
              </p>
            </div>
          ) : (
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-[#0D162B] tracking-tight leading-none">
                {titleMap[activePage] || 'Dashboard'}
              </h1>
              <p className="text-[11px] font-normal text-slate-500 tracking-tight mt-0.5 truncate">
                MAN 1 Majalengka
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
          {/* Status Koneksi GAS (Google Apps Script) */}
          {gasConnection !== undefined && (
            <div
              title={
                gasConnection?.connected
                  ? `Terhubung ke Google Apps Script (${gasConnection.source}) • Latency: ${gasConnection.latencyMs || 0}ms`
                  : `GAS Offline / Mode Lokal (${gasConnection?.message || 'Tidak terjangkau'})`
              }
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono tabular-nums font-medium transition-all select-none ${
                isSoftTheme
                  ? gasConnection?.connected
                    ? 'neu-input-pill text-emerald-700'
                    : 'neu-input-pill text-amber-700'
                  : gasConnection?.connected
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                  : 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
              }`}
            >
              <span className="relative flex items-center justify-center">
                <span
                  className={`w-2 h-2 rounded-full ${
                    gasConnection?.connected
                      ? 'bg-emerald-500 animate-ping absolute opacity-75'
                      : 'bg-amber-500'
                  }`}
                />
                <span
                  className={`w-2 h-2 rounded-full ${
                    gasConnection?.connected ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              <span>{gasConnection?.connected ? 'GAS Online' : 'Mode Offline'}</span>
            </div>
          )}

          <button
            onClick={() => setShowLogoutModal(true)}
            className={`px-3.5 py-1.5 rounded-xl font-medium text-xs tracking-wide transition-all active:scale-95 cursor-pointer ${
              isSoftTheme
                ? 'neu-flat active:neu-pressed text-rose-600 hover:text-rose-700 border border-white/80'
                : 'bg-rose-500/25 hover:bg-rose-500/35 text-rose-200 border border-rose-400/20'
            }`}
          >
            Keluar
          </button>
        </div>
      </header>

      {/* Neumorphic / Soft UI Modern Logout Confirmation Modal */}
      {showLogoutModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            className="neu-raised-card bg-[#EBF0F8] max-w-[320px] w-full p-5 rounded-[28px] text-center relative border border-white/90 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-3 shadow-inner">
              <LogOut className="w-6 h-6 stroke-[2.5]" />
            </div>
            <h3 className="text-sm font-semibold text-[#0D162B]">
              Konfirmasi Keluar
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-5 font-normal leading-relaxed">
              Apakah Anda yakin ingin keluar dari aplikasi AJAR?
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="w-full py-2.5 rounded-xl neu-flat active:neu-pressed text-slate-700 font-medium text-xs cursor-pointer transition-all active:scale-95"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutModal(false);
                  onLogout();
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 active:scale-95 text-white font-medium text-xs shadow-md shadow-rose-500/30 cursor-pointer transition-all"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
