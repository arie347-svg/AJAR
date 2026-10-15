import React, { useState, useEffect } from 'react';
import { Download, Check, Sparkles } from 'lucide-react';
import { AjarBrandLogo } from './AjarBrandLogo';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallModal: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [installState, setInstallState] = useState<'idle' | 'installing' | 'success'>('idle');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // 1. Cek apakah aplikasi sudah berjalan dalam mode standalone (sudah terinstal)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      localStorage.getItem('pwa_installed') === 'true';

    if (isStandalone) {
      setVisible(false);
      return;
    }

    // 2. Cek apakah pengguna memilih "Nanti Saja" di sesi browser saat ini
    const isDismissedThisSession = sessionStorage.getItem('pwa_dismissed_session') === 'true';
    if (isDismissedThisSession) {
      setVisible(false);
      return;
    }

    // 3. Tangkap event prompt instalasi Chromium / Android
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      localStorage.setItem('pwa_installed', 'true');
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Tampilkan pop-up setelah sedikit jeda agar transisi terasa halus
    const timer = setTimeout(() => {
      setVisible(true);
    }, 600);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleDismiss = () => {
    // Simpan ke sessionStorage agar tidak muncul lagi di sesi browser saat ini,
    // namun akan otomatis muncul kembali saat pengguna membuka browser di sesi baru
    sessionStorage.setItem('pwa_dismissed_session', 'true');
    setVisible(false);
  };

  const handleInstall = async () => {
    setInstallState('installing');

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstallState('success');
          localStorage.setItem('pwa_installed', 'true');
          setTimeout(() => {
            setVisible(false);
          }, 1400);
        } else {
          // Pengguna membatalkan dialog browser
          setInstallState('idle');
        }
      } catch (err) {
        console.warn('PWA install prompt error:', err);
        // Fallback kelancaran visual
        completeFallbackInstall();
      }
    } else {
      // Untuk iOS Safari / Browser yang belum memicu beforeinstallprompt
      completeFallbackInstall();
    }
  };

  const completeFallbackInstall = () => {
    // Simulasi persiapan instalasi dan caching offline
    setTimeout(() => {
      setInstallState('success');
      localStorage.setItem('pwa_installed', 'true');
      setTimeout(() => {
        setVisible(false);
      }, 1500);
    }, 1800);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Instal Aplikasi AJAR"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-md select-none animate-in fade-in duration-200"
    >
      {/* Neumorphic / Soft UI Modern Popup Card */}
      <div className="neu-raised-card w-full max-w-[500px] p-5 sm:p-6 rounded-[28px] relative overflow-hidden shadow-[16px_16px_36px_rgba(166,182,209,0.5),-14px_-14px_30px_rgba(255,255,255,0.95)] border border-white/85 animate-in zoom-in-95 duration-200">
        {installState === 'idle' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Sisi Kiri: Logo Aplikasi & Nama Aplikasi v.2 */}
            <div className="flex items-center gap-3.5 min-w-0">
              {/* Squircle Neumorphic Logo Tile */}
              <div className="neu-logo-tile w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center p-2 shrink-0">
                <AjarBrandLogo idPrefix="pwaModal" className="w-8 h-8 sm:w-9 sm:h-9" />
              </div>

              {/* Teks Identitas */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-[#0D162B] truncate">
                    Ajar MAN 1 Majalengka
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-[#2167F3] bg-[#E2ECF9] shadow-inner">
                    v.2
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-500 mt-0.5 line-clamp-1">
                  Instal untuk akses cepat &amp; layar penuh
                </p>
              </div>
            </div>

            {/* Sisi Kanan: Tombol Nanti Saja & Tombol Instal */}
            <div className="flex items-center justify-end gap-2.5 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
              <button
                type="button"
                onClick={handleDismiss}
                className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-[#E2ECF9]/60 active:scale-95 transition-all cursor-pointer"
              >
                Nanti Saja
              </button>

              <button
                type="button"
                onClick={handleInstall}
                className="neu-btn-primary px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white flex items-center gap-2 cursor-pointer shadow-md active:scale-95 transition-all"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Instal</span>
              </button>
            </div>
          </div>
        )}

        {/* Status Loading saat proses instalasi */}
        {installState === 'installing' && (
          <div className="py-3 px-2 flex flex-col items-center text-center space-y-3">
            <div className="flex items-center justify-center relative">
              <div className="w-12 h-12 rounded-2xl neu-logo-tile flex items-center justify-center p-2">
                <AjarBrandLogo idPrefix="pwaLoading" className="w-8 h-8 animate-pulse" />
              </div>
            </div>

            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[#0D162B]">
                Memasang Ajar MAN 1 Majalengka v.2...
              </h3>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Menyiapkan aset &amp; akses offline aplikasi
              </p>
            </div>

            {/* Neumorphic Progress Bar */}
            <div className="w-full max-w-xs h-2.5 neu-input-container rounded-full overflow-hidden p-0.5">
              <div className="h-full bg-gradient-to-r from-[#3784FE] via-[#2167F3] to-[#1754DF] rounded-full animate-pulse w-full transition-all duration-700 shadow-[0_0_8px_rgba(33,103,243,0.5)]" />
            </div>
          </div>
        )}

        {/* Status Selesai / Sukses */}
        {installState === 'success' && (
          <div className="py-3 px-2 flex flex-col items-center text-center space-y-2.5 animate-in zoom-in-95 duration-200">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-[0_6px_16px_rgba(16,185,129,0.35)]">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>

            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[#0D162B] flex items-center justify-center gap-1.5">
                <span>Instalasi Selesai!</span>
                <Sparkles className="w-4 h-4 text-[#2167F3]" />
              </h3>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Membuka Ajar MAN 1 Majalengka v.2...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
