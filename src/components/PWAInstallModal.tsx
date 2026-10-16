import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallModal: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [installState, setInstallState] = useState<'idle' | 'installing'>('idle');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // 1. Cek apakah aplikasi sudah diakses dari mode terinstal / standalone (PWA di HP)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    // Jika sudah diakses dari aplikasi yang terinstal, pop-up TIDAK PERNAH muncul
    if (isStandalone) {
      setVisible(false);
      return;
    }

    // 2. Tangkap instance beforeinstallprompt yang tersimpan di window atau listener
    const earlyPrompt = (window as unknown as { __deferredPwaPrompt?: BeforeInstallPromptEvent }).__deferredPwaPrompt;
    if (earlyPrompt) {
      setDeferredPrompt(earlyPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      (window as unknown as { __deferredPwaPrompt?: BeforeInstallPromptEvent }).__deferredPwaPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      localStorage.setItem('pwa_installed', 'true');
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Selalu tampilkan saat akses di browser
    setVisible(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleDismiss = () => {
    setVisible(false);
  };

  const handleInstall = async () => {
    setInstallState('installing');

    const promptEvent =
      deferredPrompt ||
      (window as unknown as { __deferredPwaPrompt?: BeforeInstallPromptEvent }).__deferredPwaPrompt;

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === 'accepted') {
          // Menunggu proses instalasi selesai oleh browser/OS dengan animasi loading
          const safetyTimer = setTimeout(() => {
            localStorage.setItem('pwa_installed', 'true');
            setVisible(false);
            window.location.href = '/';
          }, 3200);

          const onInstalled = () => {
            clearTimeout(safetyTimer);
            localStorage.setItem('pwa_installed', 'true');
            setVisible(false);
            window.removeEventListener('appinstalled', onInstalled);
            window.location.href = '/';
          };
          window.addEventListener('appinstalled', onInstalled);
        } else {
          // Pengguna membatalkan prompt dialog asli browser
          setInstallState('idle');
        }
      } catch (err) {
        console.warn('Install error:', err);
        completeFallbackInstall();
      }
    } else {
      // Browser seperti iOS Safari atau browser lain tanpa API beforeinstallprompt
      completeFallbackInstall();
    }
  };

  const completeFallbackInstall = () => {
    setTimeout(() => {
      localStorage.setItem('pwa_installed', 'true');
      setVisible(false);
      window.location.href = '/';
    }, 2800);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Instal Aplikasi"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-xs select-none animate-in fade-in duration-200"
    >
      {/* Pop Up Modern Neumorphism (Tactile Soft UI) Terpusat di Layar */}
      <div className="neu-raised-card w-full max-w-[280px] p-6 rounded-[28px] relative bg-[#EBF0F8] border border-white/85 shadow-[14px_14px_32px_rgba(166,182,209,0.5),-14px_-14px_30px_rgba(255,255,255,0.95)] flex flex-col items-center justify-center animate-in zoom-in-95 duration-200">
        
        {installState === 'idle' ? (
          <>
            {/* Tombol X di pojok kanan atas */}
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Tutup"
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full neu-btn flex items-center justify-center text-slate-500 hover:text-slate-800 active:scale-90 transition-all cursor-pointer"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* Hanya Tombol Instal di tengah */}
            <div className="w-full flex items-center justify-center pt-3 pb-1">
              <button
                type="button"
                onClick={handleInstall}
                className="neu-btn-primary w-full py-3.5 px-6 rounded-2xl text-base font-bold text-white shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Instal</span>
              </button>
            </div>
          </>
        ) : (
          /* Hanya Animasi Loading Ringkas Clean (Tanpa Teks & Tanpa Icon) */
          <div className="py-7 flex items-center justify-center">
            <div className="relative w-14 h-14 flex items-center justify-center">
              {/* Outer soft neumorphic inset track */}
              <div className="absolute inset-0 rounded-full neu-inset border border-white/60" />
              {/* Smooth spinning high-tech gradient circle */}
              <div className="w-10 h-10 rounded-full border-[3.5px] border-[#d8e3f2] border-t-[#2167F3] border-r-[#3784FE] animate-spin" />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
