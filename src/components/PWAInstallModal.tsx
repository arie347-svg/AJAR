import React, { useState, useEffect } from 'react';
import { X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallModal: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [installState, setInstallState] = useState<'idle' | 'installing'>('idle');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // 0. Jangan tampilkan ke bot / search engine crawler untuk mencegah false positive
    const isBot = /bot|googlebot|crawler|spider|robot|crawling|lighthouse/i.test(
      typeof navigator !== 'undefined' ? navigator.userAgent : ''
    );
    if (isBot) {
      return;
    }

    // 1. Cek apakah aplikasi sudah diakses dari mode terinstal / standalone (PWA di HP)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    // Jika sudah diakses dari aplikasi yang terinstal di HP, pop-up otomatis hilang
    if (isStandalone) {
      setVisible(false);
      return;
    }

    // 2. Tangkap instance beforeinstallprompt yang tersimpan di window atau listener
    const earlyPrompt = (window as unknown as { __deferredPwaPrompt?: BeforeInstallPromptEvent })
      .__deferredPwaPrompt;
    if (earlyPrompt) {
      setDeferredPrompt(earlyPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      (window as unknown as { __deferredPwaPrompt?: BeforeInstallPromptEvent }).__deferredPwaPrompt =
        promptEvent;
      setDeferredPrompt(promptEvent);
      setVisible(true);
    };

    const handleAppInstalled = () => {
      localStorage.setItem('pwa_installed', 'true');
      setVisible(false);
      setDeferredPrompt(null);
      window.location.href = '/';
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Tampilkan prompt jika belum pernah diinstal dan belum ditutup pada sesi ini
    const isDismissed = sessionStorage.getItem('pwa_prompt_dismissed');
    const isAlreadyInstalled = localStorage.getItem('pwa_installed') === 'true';

    if (!isDismissed && !isAlreadyInstalled) {
      // Sedikit jeda agar rendering halaman utama selesai dan ramah pengguna
      const timer = setTimeout(() => {
        setVisible(true);
      }, 800);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
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
          setInstallState('idle');
        }
      } catch {
        completeFallbackInstall();
      }
    } else {
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
      aria-label="Instal Aplikasi Resmi AJAR"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none animate-in fade-in duration-200"
    >
      {/* Pop Up Modern Neumorphism (Tactile Soft UI) Terpusat di Layar dengan Identitas Resmi */}
      <div className="neu-raised-card w-full max-w-[280px] p-5 rounded-[28px] relative bg-[#EEF2F6] border border-white/90 shadow-[12px_12px_28px_rgba(166,182,209,0.5),-12px_-12px_28px_rgba(255,255,255,0.95)] flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-200">
        {installState === 'idle' ? (
          <>
            {/* Tombol X di pojok kanan atas */}
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Tutup"
              className="absolute top-3 right-3 w-7 h-7 rounded-full neu-btn flex items-center justify-center text-slate-500 hover:text-slate-800 active:scale-90 transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            {/* Identitas Resmi Aplikasi (Mencegah Salah Deteksi Phishing/Malware) */}
            <div className="w-12 h-12 rounded-2xl neu-inset bg-[#E8EEF6] border border-white/80 flex items-center justify-center p-2 mb-2 shadow-inner">
              <img
                src="/icon.svg"
                alt="Logo AJAR"
                className="w-full h-full object-contain"
                onError={e => {
                  // Fallback icon jika svg belum dimuat
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <Smartphone className="w-6 h-6 text-blue-600 hidden only:block" />
            </div>

            <div className="space-y-0.5 mb-3.5">
              <h3 className="text-xs font-semibold text-[#0D162B] tracking-tight">
                Instal Aplikasi AJAR 2.0
              </h3>
              <p className="text-[11px] text-[#5A6578] font-normal leading-tight">
                MAN 1 Majalengka
              </p>
            </div>

            {/* Tombol Instal */}
            <div className="w-full flex items-center justify-center">
              <button
                type="button"
                onClick={handleInstall}
                className="neu-btn-primary w-full py-2.5 px-5 rounded-2xl text-xs font-medium text-white shadow-md flex items-center justify-center cursor-pointer active:scale-95 transition-all"
              >
                Instal
              </button>
            </div>
          </>
        ) : (
          /* Hanya Animasi Loading Ringkas Clean (Tanpa Kata-Kata & Tanpa Icon Sesuai Request) */
          <div className="py-6 flex items-center justify-center">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full neu-inset border border-white/60" />
              <div className="w-8 h-8 rounded-full border-[3px] border-[#d8e3f2] border-t-[#2167F3] border-r-[#3784FE] animate-spin" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
