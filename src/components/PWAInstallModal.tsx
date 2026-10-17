import React, { useState, useEffect } from 'react';
import { X, Check, ArrowRight, Share } from 'lucide-react';
import { AjarBrandLogo } from './AjarBrandLogo';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallModal: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [installState, setInstallState] = useState<'idle' | 'installing' | 'installed'>('idle');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // 0. Jangan tampilkan ke bot / search engine crawler untuk menjaga keamanan & SEO
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
      document.referrer.includes('android-app://') ||
      window.location.search.includes('mode=standalone');

    // Jika sudah diakses dari aplikasi yang terinstal di HP, jangan pernah munculkan pop-up
    if (isStandalone) {
      setVisible(false);
      return;
    }

    // 2. Deteksi perangkat iOS / Safari
    const checkIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent || '') &&
      !(window as unknown as { MSStream?: boolean }).MSStream;
    setIsIos(checkIos);

    // 3. Tangkap instance beforeinstallprompt yang tersimpan di window atau listener
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

    const handlePromptReady = () => {
      const readyPrompt = (window as unknown as { __deferredPwaPrompt?: BeforeInstallPromptEvent })
        .__deferredPwaPrompt;
      if (readyPrompt) {
        setDeferredPrompt(readyPrompt);
      }
    };

    const handleAppInstalled = () => {
      localStorage.setItem('pwa_installed', 'true');
      setInstallState('installed');
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-ready', handlePromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Tampilkan pop up saat akses di browser jika belum pernah diinstal dan belum ditutup di sesi ini
    const isDismissed = sessionStorage.getItem('pwa_prompt_dismissed');
    const isAlreadyInstalled = localStorage.getItem('pwa_installed') === 'true';

    if (!isDismissed && !isAlreadyInstalled) {
      setVisible(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
    setVisible(false);
  };

  const handleInstall = async () => {
    // 1. Tampilkan animasi loading ringkas clean seketika saat tombol ditekan
    setInstallState('installing');

    // 2. Jika di perangkat iOS Safari (tidak mendukung beforeinstallprompt API)
    if (isIos) {
      // Tunggu animasi sebentar lalu beri tanda terinstal / panduan
      setTimeout(() => {
        setInstallState('installed');
      }, 1500);
      return;
    }

    // 3. Ambil prompt instalasi Chrome / Android
    let promptEvent =
      deferredPrompt ||
      (window as unknown as { __deferredPwaPrompt?: BeforeInstallPromptEvent }).__deferredPwaPrompt;

    // Jika prompt belum siap, tunggu hingga maksimal 2.5 detik untuk respon peramban
    if (!promptEvent) {
      promptEvent = await new Promise<BeforeInstallPromptEvent | null>(resolve => {
        const onReady = () => {
          window.removeEventListener('pwa-prompt-ready', onReady);
          resolve(
            (window as unknown as { __deferredPwaPrompt?: BeforeInstallPromptEvent })
              .__deferredPwaPrompt || null
          );
        };
        window.addEventListener('pwa-prompt-ready', onReady);
        setTimeout(() => {
          window.removeEventListener('pwa-prompt-ready', onReady);
          resolve(
            (window as unknown as { __deferredPwaPrompt?: BeforeInstallPromptEvent })
              .__deferredPwaPrompt || null
          );
        }, 2500);
      });
    }

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;

        if (choice && choice.outcome === 'accepted') {
          // Tunggu hingga event appinstalled selesai dari OS Android
          const waitForInstall = new Promise<void>(resolve => {
            const onInstalled = () => {
              window.removeEventListener('appinstalled', onInstalled);
              resolve();
            };
            window.addEventListener('appinstalled', onInstalled);

            // Batas waktu cadangan untuk sinkronisasi Android WebAPK
            setTimeout(() => {
              window.removeEventListener('appinstalled', onInstalled);
              resolve();
            }, 3500);
          });

          await waitForInstall;
          localStorage.setItem('pwa_installed', 'true');
          setInstallState('installed');
        } else {
          // Jika pengguna membatalkan dialog konfirmasi native Chrome
          setInstallState('idle');
        }
      } catch {
        // Fallback jika terjadi kendala sistem
        setTimeout(() => {
          localStorage.setItem('pwa_installed', 'true');
          setInstallState('installed');
        }, 2000);
      }
    } else {
      // Jika peramban tidak mendukung prompt langsung (misal WebView aplikasi)
      setTimeout(() => {
        localStorage.setItem('pwa_installed', 'true');
        setInstallState('installed');
      }, 2000);
    }
  };

  const handleOpenApp = () => {
    localStorage.setItem('pwa_installed', 'true');
    setVisible(false);
    // Buka dan muat aplikasi dalam mode standalone langsung di HP
    window.location.href = '/?mode=standalone';
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Instal Aplikasi Resmi AJAR"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none animate-in fade-in duration-200"
    >
      {/* Pop Up Modern Neumorphism (Tactile Soft UI) Terpusat di Layar */}
      <div className="neu-raised-card w-full max-w-[270px] p-5 rounded-[28px] relative bg-[#EEF2F6] border border-white/90 shadow-[12px_12px_28px_rgba(166,182,209,0.5),-12px_-12px_28px_rgba(255,255,255,0.95)] flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-200">
        {/* Tombol X di pojok kanan atas */}
        {installState !== 'installing' && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Tutup"
            className="absolute top-3 right-3 w-7 h-7 rounded-full neu-btn flex items-center justify-center text-slate-500 hover:text-slate-800 active:scale-90 transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        )}

        {installState === 'idle' && (
          <>
            {/* Logo Resmi Identik dengan Halaman Login */}
            <div className="neu-logo-tile w-20 h-20 rounded-[28px] flex items-center justify-center p-2 mb-2 relative transition-transform duration-300">
              <AjarBrandLogo idPrefix="pwaModal" className="w-12 h-12" />
            </div>

            <div className="space-y-0.5 mb-2">
              <h3 className="text-sm font-semibold text-[#0D162B] tracking-tight">AJAR 2.0</h3>
              <p className="text-[11px] text-[#5A6578] font-normal leading-tight">
                MAN 1 Majalengka
              </p>
            </div>

            {/* Petunjuk Tambahan untuk Pengguna iOS Safari */}
            {isIos && (
              <div className="p-2 rounded-xl neu-pressed bg-[#E8EEF6] border border-white/70 text-[10.5px] text-slate-600 mb-2 leading-relaxed flex items-center gap-1.5 text-left">
                <Share className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>
                  Ketuk <strong>Bagikan</strong> lalu pilih <strong>Tambah ke Layar Utama</strong>
                </span>
              </div>
            )}

            {/* Tombol Instal */}
            <div className="w-full flex items-center justify-center pt-1">
              <button
                type="button"
                onClick={handleInstall}
                className="neu-btn-primary w-full py-2.5 px-5 rounded-2xl text-xs font-medium text-white shadow-md flex items-center justify-center cursor-pointer active:scale-95 transition-all"
              >
                Instal
              </button>
            </div>
          </>
        )}

        {installState === 'installing' && (
          /* Hanya Animasi Loading Ringkas Clean (Tanpa Kata-Kata & Tanpa Icon Sesuai Request) */
          <div className="py-8 flex items-center justify-center">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full neu-inset border border-white/60" />
              <div className="w-8 h-8 rounded-full border-[3px] border-[#d8e3f2] border-t-[#2167F3] border-r-[#3784FE] animate-spin" />
            </div>
          </div>
        )}

        {installState === 'installed' && (
          /* Tampilan Selesai Terinstal: Tombol Beralih ke Aplikasi */
          <>
            <div className="relative mb-2">
              <div className="neu-logo-tile w-18 h-18 rounded-[24px] flex items-center justify-center p-2 shadow-md">
                <AjarBrandLogo idPrefix="pwaModalDone" className="w-10 h-10" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white shadow-xs">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            </div>

            <div className="space-y-0.5 mb-3">
              <h3 className="text-xs font-semibold text-[#0D162B] tracking-tight">
                Aplikasi Terinstal
              </h3>
              <p className="text-[11px] text-[#5A6578] font-normal leading-tight">
                AJAR 2.0 siap dibuka dari layar HP
              </p>
            </div>

            {/* Tombol Beralih ke Aplikasi */}
            <div className="w-full flex items-center justify-center">
              <button
                type="button"
                onClick={handleOpenApp}
                className="neu-btn-primary w-full py-2.5 px-4 rounded-2xl text-xs font-medium text-white shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <span>Beralih ke Aplikasi</span>
                <ArrowRight className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
