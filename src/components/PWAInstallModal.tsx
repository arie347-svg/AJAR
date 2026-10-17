import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, ArrowRight, Share, MoreVertical, Copy, ExternalLink } from 'lucide-react';
import { AjarBrandLogo } from './AjarBrandLogo';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallModal: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [installState, setInstallState] = useState<
    'idle' | 'installing' | 'installed' | 'guide_android' | 'guide_ios' | 'in_app_browser'
  >('idle');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  useEffect(() => {
    // 0. Jangan tampilkan ke bot / search engine crawler untuk menjaga keamanan & reputasi Safe Browsing
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
      window.location.search.includes('mode=standalone') ||
      window.location.search.includes('source=pwa');

    // Jika sudah diakses dari aplikasi yang terinstal di HP, jangan munculkan pop-up instal
    if (isStandalone) {
      setVisible(false);
      return;
    }

    // 2. Deteksi perangkat iOS / Safari
    const checkIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent || '') &&
      !(window as unknown as { MSStream?: boolean }).MSStream;
    setIsIos(checkIos);

    // 3. Deteksi In-App Browser (WhatsApp, Instagram, Telegram, Facebook WebView)
    const ua = navigator.userAgent || '';
    const checkInApp =
      /WhatsApp/i.test(ua) ||
      /FBAN|FBAV/i.test(ua) ||
      /Instagram/i.test(ua) ||
      /Line/i.test(ua) ||
      /Telegram/i.test(ua) ||
      /MicroMessenger/i.test(ua);
    setIsInAppBrowser(checkInApp);

    // 4. Tangkap instance beforeinstallprompt yang tersimpan di window atau listener
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
    // A. Jika dibuka dari In-App Browser (misal dari chat WhatsApp)
    if (isInAppBrowser) {
      setInstallState('in_app_browser');
      return;
    }

    // B. Jika perangkat iOS Safari
    if (isIos) {
      setInstallState('guide_ios');
      return;
    }

    // C. Ambil prompt instalasi resmi Chrome Android
    const promptEvent =
      deferredPrompt ||
      (window as unknown as { __deferredPwaPrompt?: BeforeInstallPromptEvent }).__deferredPwaPrompt;

    if (promptEvent) {
      // Panggil prompt() SECARA LANGSUNG & SINKRON pada aksi klik untuk menjaga User Gesture Token
      try {
        setInstallState('installing');
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;

        if (choice && choice.outcome === 'accepted') {
          // Tunggu hingga event resmi appinstalled diterima dari sistem Android
          const waitForInstall = new Promise<void>(resolve => {
            const onInstalled = () => {
              window.removeEventListener('appinstalled', onInstalled);
              resolve();
            };
            window.addEventListener('appinstalled', onInstalled);

            // Timeout toleransi sinkronisasi WebAPK Android
            setTimeout(() => {
              window.removeEventListener('appinstalled', onInstalled);
              resolve();
            }, 3500);
          });

          await waitForInstall;
          localStorage.setItem('pwa_installed', 'true');
          setInstallState('installed');
        } else {
          // Pengguna membatalkan dialog native Chrome
          setInstallState('idle');
        }
      } catch (err) {
        console.warn('[PWA] Prompt error:', err);
        setInstallState('guide_android');
      }
    } else {
      // Jika promptEvent belum tersedia dari browser Chrome Android
      setInstallState('guide_android');
    }
  };

  const handleOpenApp = () => {
    localStorage.setItem('pwa_installed', 'true');
    setVisible(false);
    // Buka dan muat aplikasi dalam mode standalone langsung di HP
    window.location.href = '/?mode=standalone';
  };

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.origin);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    } catch {
      // Fallback
    }
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
      <div className="neu-raised-card w-full max-w-[280px] p-5 rounded-[28px] relative bg-[#EEF2F6] border border-white/90 shadow-[12px_12px_28px_rgba(166,182,209,0.5),-12px_-12px_28px_rgba(255,255,255,0.95)] flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-200">
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

        {/* ========================================================================= */}
        {/* STATE 1: IDLE (TAMPILAN AWAL SEBELUM TEKAN TOMBOL)                        */}
        {/* ========================================================================= */}
        {installState === 'idle' && (
          <>
            {/* Logo Resmi Identik dengan Halaman Login */}
            <div className="neu-logo-tile w-20 h-20 rounded-[28px] flex items-center justify-center p-2 mb-2 relative transition-transform duration-300 shadow-md">
              <AjarBrandLogo idPrefix="pwaModal" className="w-12 h-12" />
            </div>

            <div className="space-y-0.5 mb-2.5">
              <h3 className="text-sm font-semibold text-[#0D162B] tracking-tight">AJAR 2.0</h3>
              <p className="text-[11px] text-[#5A6578] font-normal leading-tight">
                MAN 1 Majalengka
              </p>
            </div>

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

        {/* ========================================================================= */}
        {/* STATE 2: INSTALLING (HANYA ANIMASI LOADING RINGKAS CLEAN)                 */}
        {/* ========================================================================= */}
        {installState === 'installing' && (
          /* Hanya Animasi Loading Ringkas Clean Tanpa Teks & Tanpa Ikon */
          <div className="py-8 flex items-center justify-center">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full neu-inset border border-white/60" />
              <div className="w-8 h-8 rounded-full border-[3px] border-[#d8e3f2] border-t-[#2167F3] border-r-[#3784FE] animate-spin" />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STATE 3: INSTALLED (IKON CEKLIS & TULISAN TERINSTAL HIJAU)                 */}
        {/* ========================================================================= */}
        {installState === 'installed' && (
          <>
            {/* Animasi Loading Berganti Menjadi Ikon Ceklis Hijau */}
            <div className="w-14 h-14 rounded-full neu-inset bg-[#E8EEF6] border border-white/80 flex items-center justify-center p-2 mb-2 shadow-inner text-emerald-600 animate-in zoom-in-75 duration-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 stroke-[2.4]" />
            </div>

            {/* Tulisan Terinstal Warna Hijau */}
            <div className="space-y-0.5 mb-3.5 animate-in fade-in duration-200">
              <h3 className="text-sm font-semibold text-emerald-600 tracking-tight">
                Terinstal
              </h3>
              <p className="text-[11px] text-[#5A6578] font-normal leading-tight">
                Aplikasi siap dibuka langsung di HP
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

        {/* ========================================================================= */}
        {/* STATE 4: IN-APP BROWSER (WHATSAPP WEBVIEW NOTICE)                         */}
        {/* ========================================================================= */}
        {installState === 'in_app_browser' && (
          <div className="space-y-2.5 text-left py-1 animate-in fade-in">
            <div className="text-center">
              <span className="inline-block p-2 rounded-2xl neu-inset bg-[#E8EEF6] text-blue-600 mb-1">
                <ExternalLink className="w-5 h-5" />
              </span>
              <h3 className="text-xs font-semibold text-[#0D162B]">Buka di Google Chrome</h3>
              <p className="text-[10.5px] text-[#5A6578] mt-0.5">
                WhatsApp membatasi instalasi PWA. Silakan buka di peramban Chrome:
              </p>
            </div>

            <div className="p-2.5 rounded-xl neu-pressed bg-[#E8EEF6] border border-white/80 space-y-1 text-[10.5px] text-slate-700">
              <div className="flex items-start gap-1.5">
                <span className="font-semibold text-blue-700">1.</span>
                <span>Ketuk ikon titik tiga (⋮) di pojok kanan atas layar WhatsApp.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="font-semibold text-blue-700">2.</span>
                <span>Pilih <strong>Buka di Chrome</strong> (Open in Chrome).</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full py-2 px-3 rounded-xl neu-btn text-[11px] font-medium text-blue-700 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copyFeedback ? 'Link Berhasil Disalin!' : 'Salin Link Aplikasi'}</span>
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STATE 5: PANDUAN ANDROID CHROME MANUAL (JIKA PROMPT OTOMATIS TIDAK MUNCUL)  */}
        {/* ========================================================================= */}
        {installState === 'guide_android' && (
          <div className="space-y-2.5 text-left py-1 animate-in fade-in">
            <div className="text-center">
              <span className="inline-block p-2 rounded-2xl neu-inset bg-[#E8EEF6] text-blue-600 mb-1">
                <MoreVertical className="w-5 h-5" />
              </span>
              <h3 className="text-xs font-semibold text-[#0D162B]">Instal Manual di Chrome</h3>
              <p className="text-[10.5px] text-[#5A6578] mt-0.5">
                Pasang aplikasi langsung melalui menu Google Chrome:
              </p>
            </div>

            <div className="p-2.5 rounded-xl neu-pressed bg-[#E8EEF6] border border-white/80 space-y-1 text-[10.5px] text-slate-700">
              <div className="flex items-start gap-1.5">
                <span className="font-semibold text-blue-700">1.</span>
                <span>Ketuk ikon menu titik tiga (<strong>⋮</strong>) di kanan atas peramban Chrome.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="font-semibold text-blue-700">2.</span>
                <span>Pilih <strong>Instal aplikasi</strong> atau <strong>Tambahkan ke Layar Utama</strong>.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="font-semibold text-blue-700">3.</span>
                <span>Ketuk <strong>Instal</strong> pada konfirmasi Android.</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenApp}
              className="neu-btn-primary w-full py-2 px-4 rounded-xl text-xs font-medium text-white shadow-md flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
            >
              <span>Sudah Menginstal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STATE 6: PANDUAN IOS SAFARI (IPHONE / IPAD)                                */}
        {/* ========================================================================= */}
        {installState === 'guide_ios' && (
          <div className="space-y-2.5 text-left py-1 animate-in fade-in">
            <div className="text-center">
              <span className="inline-block p-2 rounded-2xl neu-inset bg-[#E8EEF6] text-blue-600 mb-1">
                <Share className="w-5 h-5" />
              </span>
              <h3 className="text-xs font-semibold text-[#0D162B]">Instal di iPhone (iOS)</h3>
              <p className="text-[10.5px] text-[#5A6578] mt-0.5">
                Gunakan menu Safari untuk menambahkan ke layar utama:
              </p>
            </div>

            <div className="p-2.5 rounded-xl neu-pressed bg-[#E8EEF6] border border-white/80 space-y-1 text-[10.5px] text-slate-700">
              <div className="flex items-start gap-1.5">
                <span className="font-semibold text-blue-700">1.</span>
                <span>Ketuk tombol <strong>Bagikan</strong> (Share ikon kotak panah ke atas) di bilah Safari.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="font-semibold text-blue-700">2.</span>
                <span>Gulir ke bawah dan ketuk <strong>Tambah ke Layar Utama</strong> (+).</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="font-semibold text-blue-700">3.</span>
                <span>Ketuk <strong>Tambah</strong> di pojok kanan atas.</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenApp}
              className="neu-btn-primary w-full py-2 px-4 rounded-xl text-xs font-medium text-white shadow-md flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
            >
              <span>Selesai Menambahkan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
