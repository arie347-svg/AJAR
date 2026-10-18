import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageId, User, DashboardData, MasterAjarData, ReferencesMap, PengajaranItem } from './types';
import {
  callGasApi,
  DEFAULT_REFERENCES,
  getCachedReferences,
  saveCachedReferences,
  checkGasConnection,
  GasConnectionInfo,
} from './services/gasApi';
import { RefreshCw } from 'lucide-react';
import { AuthPage } from './components/AuthPage';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { BottomNav } from './components/BottomNav';
import { Dashboard } from './components/Dashboard';
import { MasterAjar } from './components/MasterAjar';
import { MasterSiswa } from './components/MasterSiswa';
import { Absensi } from './components/Absensi';
import { Nilai } from './components/Nilai';
import { LkhWizard } from './components/LkhWizard';
import { Laporan } from './components/Laporan';
import { Profil } from './components/Profil';
import { Toast, ToastMessage } from './components/Toast';
import { AjarBrandLogo } from './components/AjarBrandLogo';
import { PWAInstallModal } from './components/PWAInstallModal';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string>(() => localStorage.getItem('ajar_token') || '');
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  // Memuat data referensi secara instan dari cache lokal (SWR)
  const [references, setReferences] = useState<ReferencesMap>(() => getCachedReferences());

  // Splash & Sistem Handshake State
  const [loadingSplash, setLoadingSplash] = useState(true);
  const [splashPhase, setSplashPhase] = useState<'checking' | 'syncing' | 'connected' | 'error'>('checking');
  const [splashStatusText, setSplashStatusText] = useState('Menghubungkan ke Google Apps Script...');
  const [splashDetailText, setSplashDetailText] = useState('Memverifikasi secret GAS_URL & status spreadsheet madrasah');
  const [splashProgress, setSplashProgress] = useState(25);
  const [gasConnection, setGasConnection] = useState<GasConnectionInfo | null>(null);
  const [syncSummary, setSyncSummary] = useState<{ totalKelas: number; totalMapel: number } | null>(null);

  const [dashboardData, setDashboardData] = useState<DashboardData>({
    tahunAjaran: '2026/2027',
    totalKelas: 0,
    totalMapel: 0,
    totalSiswa: 0,
  });

  const [masterAjarData, setMasterAjarData] = useState<MasterAjarData>({
    success: true,
    waliKelas: '',
    mapelUtamaId: '',
    mapelUtama: null,
    mapelTambahan: [],
    pengajaran: [],
    tahunAjaran: '2026/2027',
    listKelas: getCachedReferences().Kelas,
    listMapel: getCachedReferences().MataPelajaran,
  });

  const [pengajaranList, setPengajaranList] = useState<PengajaranItem[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      dismissToast(id);
    }, 3200);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Inisialisasi sistem: Verifikasi nyata koneksi Google Apps Script & sinkronisasi Spreadsheet
  const runSystemInitialization = useCallback(async (isManualRetry = false) => {
    setLoadingSplash(true);
    setSplashPhase('checking');
    setSplashProgress(25);
    setSplashStatusText('Memeriksa koneksi sistem...');
    setSplashDetailText('Menghubungi runtime Google Apps Script via proxy server');

    // Auto-dismiss timer: cegah splash screen mengunci pengguna jika GAS sedang cold-start (>2.4s)
    let autoDismissTimer: NodeJS.Timeout | null = null;
    if (!isManualRetry) {
      autoDismissTimer = setTimeout(() => {
        setLoadingSplash(false);
      }, 2400);
    }

    try {
      // 1. Verifikasi koneksi nyata ke Google Apps Script dan secret GAS_URL (toleransi cold start 25s)
      const conn = await checkGasConnection(25000);
      setGasConnection(conn);

      if (!conn.connected) {
        if (isManualRetry) {
          setSplashPhase('error');
          setSplashStatusText('Koneksi ke GAS Tertunda');
          setSplashDetailText(conn.message || 'Server sedang cold-start atau offline');
          setSplashProgress(45);
        } else {
          if (autoDismissTimer) clearTimeout(autoDismissTimer);
          setLoadingSplash(false);
        }
        return;
      }

      // 2. Terhubung! Sinkronisasi data referensi langsung dari Spreadsheet GAS
      setSplashPhase('syncing');
      setSplashProgress(68);
      setSplashStatusText('Sinkronisasi data Spreadsheet...');
      setSplashDetailText(
        `Terhubung via ${conn.source} (${conn.latencyMs ? conn.latencyMs + 'ms' : 'aktif'}) — Mengunduh rombel kelas & mapel madrasah`
      );

      const refRes = await callGasApi<any>('getReferencesData', [], 20000);

      if (refRes && refRes.references) {
        const refs = refRes.references;
        saveCachedReferences(refs);
        setReferences(prev => ({ ...prev, ...refs }));

        const kelasList = refs.Kelas || [];
        const mapelList = refs.MataPelajaran || refs.Mapel || [];

        setMasterAjarData(prev => ({
          ...prev,
          listKelas: kelasList.length > 0 ? kelasList : prev.listKelas,
          listMapel: mapelList.length > 0 ? mapelList : prev.listMapel,
        }));

        setSyncSummary({
          totalKelas: kelasList.length,
          totalMapel: mapelList.length,
        });

        // 3. Status Terhubung Sukses
        setSplashPhase('connected');
        setSplashProgress(100);
        setSplashStatusText('Sistem Terhubung ke GAS (Spreadsheet Aktif)');
        setSplashDetailText(
          `Berhasil memuat ${kelasList.length} Rombel Kelas & ${mapelList.length} Mata Pelajaran`
        );

        if (autoDismissTimer) clearTimeout(autoDismissTimer);
        setTimeout(() => {
          setLoadingSplash(false);
        }, 500);
      } else {
        // GAS merespon tetapi data referensi tidak lengkap -> fallback ke cache
        setSplashPhase('connected');
        setSplashProgress(100);
        setSplashStatusText('Sistem Terhubung');
        setSplashDetailText(`Koneksi aktif via ${conn.source}`);
        if (autoDismissTimer) clearTimeout(autoDismissTimer);
        setTimeout(() => {
          setLoadingSplash(false);
        }, 400);
      }
    } catch (err: any) {
      console.warn('[App] Error inisialisasi GAS:', err);
      if (isManualRetry) {
        setSplashPhase('error');
        setSplashStatusText('Koneksi ke GAS Terkendala');
        setSplashDetailText(err?.message || 'Waktu koneksi habis saat menghubungi server');
        setSplashProgress(45);
      } else {
        if (autoDismissTimer) clearTimeout(autoDismissTimer);
        setLoadingSplash(false);
      }
    }
  }, []);

  useEffect(() => {
    runSystemInitialization();
  }, [runSystemInitialization]);

  // When user is authenticated, load dashboard and master ajar
  useEffect(() => {
    if (currentUser && token) {
      loadDashboard();
      loadMasterAjar();
    }
  }, [currentUser, token]);

  const loadDashboard = async () => {
    try {
      const res = await callGasApi('getDashboardData', [token]);
      if (res) {
        setDashboardData({
          tahunAjaran: res.tahunAjaran || '2026/2027',
          totalKelas: res.totalKelas || 0,
          totalMapel: res.totalMapel || 0,
          totalSiswa: res.totalSiswa || 0,
        });
      }
    } catch {}
  };

  const loadMasterAjar = async () => {
    try {
      const res = await callGasApi('getMasterAjarData', [token]);
      if (res && res.success) {
        const cached = getCachedReferences();
        // Rekonstruksi pengajaran jika kosong tetapi mapelUtama ada
        let derivedPengajaran = res.pengajaran || [];
        if (derivedPengajaran.length === 0 && res.mapelUtama && res.mapelUtama.kelases?.length) {
          derivedPengajaran = res.mapelUtama.kelases.map((k: string) => ({
            mapelId: res.mapelUtama.mapelId,
            mapelNama: res.mapelUtama.mapelNama,
            kelas: k,
            isUtama: true,
          }));
          if (res.mapelTambahan && Array.isArray(res.mapelTambahan)) {
            res.mapelTambahan.forEach((t: any) => {
              if (t.kelases && Array.isArray(t.kelases)) {
                t.kelases.forEach((k: string) => {
                  derivedPengajaran.push({
                    mapelId: t.mapelId,
                    mapelNama: t.mapelNama,
                    kelas: k,
                    isUtama: false,
                  });
                });
              }
            });
          }
        }

        const merged: MasterAjarData = {
          ...res,
          pengajaran: derivedPengajaran,
          listKelas: res.listKelas && res.listKelas.length > 0 ? res.listKelas : cached.Kelas,
          listMapel: res.listMapel && res.listMapel.length > 0 ? res.listMapel : cached.MataPelajaran,
        };
        setMasterAjarData(merged);
        setPengajaranList(derivedPengajaran);
      }
    } catch {}
  };

  // State pembuka kunci menu Master Ajar secara instan saat verifikasi berhasil
  const [isMasterAjarUnlockedLocally, setIsMasterAjarUnlockedLocally] = useState<boolean>(false);

  // Deteksi apakah konfigurasi Master Ajar telah diselesaikan oleh guru
  const isMasterAjarComplete = useMemo(() => {
    if (isMasterAjarUnlockedLocally) return true;
    if (!currentUser) return true;
    if (!masterAjarData || !masterAjarData.success) return true;

    const currentTa = masterAjarData.tahunAjaran || '2026/2027';
    // Periksa flag konfigurasi dari berbagai identitas akun (userId, NIP, username)
    const isTaFlagged =
      localStorage.getItem(`master_ajar_configured_${currentUser.userId}_${currentTa}`) === 'true' ||
      localStorage.getItem(`master_ajar_configured_${currentUser.nip}_${currentTa}`) === 'true' ||
      localStorage.getItem(`master_ajar_configured_${currentUser.username}_${currentTa}`) === 'true' ||
      localStorage.getItem(`master_ajar_configured_${currentTa}`) === 'true';

    // Memiliki penugasan mengajar:
    // 1. Dari array pengajaran (data resmi dari spreadsheet / server GAS)
    // 2. Atau dari mapelUtama dengan kelas yang dipilih
    const hasPengajaran = Boolean(
      (masterAjarData.pengajaran && masterAjarData.pengajaran.length > 0) ||
      ((masterAjarData.mapelUtamaId || masterAjarData.mapelUtama?.mapelId) &&
        (masterAjarData.mapelUtama?.kelases?.length || 0) > 0)
    );

    // Memiliki penentuan wali kelas (pilih kelas tertentu atau Bukan Wali Kelas)
    const hasWaliSelection = Boolean(
      masterAjarData.waliKelas && masterAjarData.waliKelas.trim() !== ''
    );

    // Guru yang sudah memiliki data mengajar dan telah menentukan status wali kelas dianggap LENGKAP.
    if ((hasPengajaran && hasWaliSelection) || isTaFlagged) {
      return true;
    }

    return false;
  }, [currentUser, masterAjarData, isMasterAjarUnlockedLocally]);

  // Arahkan ke Master Ajar HANYA jika data telah selesai dimuat dan terbukti belum memiliki konfigurasi
  useEffect(() => {
    if (currentUser && masterAjarData && masterAjarData.success) {
      if (!isMasterAjarComplete && activePage !== 'master-ajar') {
        setActivePage('master-ajar');
        showToast(
          'Mohon lengkapi konfigurasi Master Ajar terlebih dahulu untuk mengaktifkan seluruh menu aplikasi.',
          'warning'
        );
      }
    }
  }, [currentUser, masterAjarData, isMasterAjarComplete, activePage]);

  const handleNavigate = (page: PageId) => {
    if (!isMasterAjarComplete && page !== 'master-ajar') {
      showToast(
        'Lengkapi konfigurasi Master Ajar (Mata Pelajaran & Kelas) terlebih dahulu!',
        'warning'
      );
      return;
    }
    setActivePage(page);
  };

  const handleLoginSuccess = (user: User, userToken: string) => {
    setCurrentUser(user);
    setToken(userToken);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('ajar_token', userToken);
    setActivePage('dashboard');
  };

  const handleLogout = () => {
    setIsMasterAjarUnlockedLocally(false);
    setCurrentUser(null);
    setToken('');
    localStorage.removeItem('user');
    localStorage.removeItem('ajar_token');
    localStorage.removeItem('ajar_remember_login');
    showToast('Berhasil keluar.', 'info');
  };

  return (
    <div className="h-full w-full flex flex-col md:flex-row relative overflow-hidden bg-[#EEF2F6]">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <PWAInstallModal />

      {/* Splash Screen: Background Putih, Pembungkus Icon Transparan, Icon PNG */}
      {loadingSplash && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center p-4 transition-opacity duration-300 select-none">
          <div className="relative z-10 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-200">
            {/* Pembungkus Icon Transparan Tanpa Kotak/Border dengan Icon PNG */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center bg-transparent">
              <img
                src="/icon-512.png"
                alt="AJAR 2.0"
                className="w-20 h-20 sm:w-24 sm:h-24 object-contain filter drop-shadow-[0_10px_16px_rgba(33,103,243,0.22)] select-none pointer-events-none"
              />
            </div>

            {/* Tulisan Connecting... dengan Soft UI Modern */}
            <div className="mt-6 flex flex-col items-center">
              <div className="px-5 py-2 rounded-full bg-[#F1F5F9] border border-slate-200/60 shadow-sm flex items-center gap-2.5">
                <span className="relative flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2167F3] animate-ping absolute opacity-75" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2167F3]" />
                </span>
                <span className="text-xs sm:text-sm font-bold tracking-wider text-slate-700">
                  Connecting...
                </span>
              </div>

              {/* Opsi jika terjadi kendala timeout/offline */}
              {splashPhase === 'error' && (
                <div className="mt-4 flex flex-col items-center gap-2 animate-in fade-in duration-200">
                  <p className="text-[11px] font-semibold text-rose-600 max-w-xs text-center">
                    {splashDetailText || 'Koneksi ke sistem tertunda'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => runSystemInitialization(true)}
                      className="py-2 px-3.5 rounded-xl neu-btn-primary text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-transform"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Coba Lagi
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoadingSplash(false)}
                      className="py-2 px-3.5 rounded-xl neu-flat active:neu-pressed text-slate-700 font-bold text-xs cursor-pointer active:scale-95 transition-transform"
                    >
                      Lanjutkan
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Authentication View (if not logged in) */}
      {!currentUser ? (
        <AuthPage
          references={references}
          onLoginSuccess={handleLoginSuccess}
          showToast={showToast}
          gasConnection={gasConnection}
        />
      ) : (
        /* Logged In Application Shell */
        <>
          {/* Desktop Sidebar */}
          <Sidebar
            activePage={activePage}
            onNavigate={handleNavigate}
            currentUser={currentUser}
            onLogout={handleLogout}
            isMasterAjarLocked={!isMasterAjarComplete}
          />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#EEF2F6]">
            <Topbar
              activePage={activePage}
              onNavigate={handleNavigate}
              onLogout={handleLogout}
              gasConnection={gasConnection}
            />

            <main
              className={
                activePage === 'dashboard'
                  ? 'flex-1 h-full min-h-0 overflow-hidden p-3 sm:p-4 max-w-xl w-full mx-auto flex flex-col'
                  : activePage === 'master-ajar'
                  ? 'flex-1 h-full min-h-0 overflow-hidden p-2.5 sm:p-4 max-w-5xl w-full mx-auto flex flex-col'
                  : activePage === 'profil'
                  ? 'flex-1 h-full min-h-0 overflow-y-auto no-scrollbar p-3 sm:p-4 max-w-lg w-full mx-auto flex flex-col'
                  : activePage === 'master-siswa'
                  ? 'flex-1 h-full min-h-0 overflow-hidden p-3 sm:p-4 max-w-xl w-full mx-auto flex flex-col'
                  : activePage === 'absensi' || activePage === 'nilai' || activePage === 'lkh'
                  ? 'flex-1 h-full min-h-0 overflow-hidden px-3 pt-2 pb-16 md:pb-3 sm:px-4 max-w-xl w-full mx-auto flex flex-col'
                  : 'flex-1 overflow-y-auto overscroll-contain touch-scroll p-3.5 sm:p-5 max-w-4xl w-full mx-auto'
              }
            >
              {activePage === 'dashboard' && (
                <Dashboard
                  currentUser={currentUser}
                  data={dashboardData}
                  onNavigate={handleNavigate}
                />
              )}

              {activePage === 'master-ajar' && (
                <MasterAjar
                  data={masterAjarData}
                  token={token}
                  onRefresh={loadMasterAjar}
                  showToast={showToast}
                  currentUser={currentUser}
                  onVerified={() => {
                    setIsMasterAjarUnlockedLocally(true);
                    loadMasterAjar();
                  }}
                />
              )}

              {activePage === 'master-siswa' && (
                <MasterSiswa
                  token={token}
                  listKelas={masterAjarData.listKelas || references.Kelas}
                  pengajaranList={pengajaranList}
                  showToast={showToast}
                />
              )}

              {activePage === 'absensi' && (
                <Absensi
                  token={token}
                  pengajaranList={pengajaranList}
                  currentUser={currentUser}
                  showToast={showToast}
                  onNavigate={handleNavigate}
                />
              )}

              {activePage === 'nilai' && (
                <Nilai
                  token={token}
                  pengajaranList={pengajaranList}
                  currentUser={currentUser}
                  showToast={showToast}
                  onNavigate={handleNavigate}
                />
              )}

              {activePage === 'lkh' && (
                <LkhWizard
                  token={token}
                  currentUser={currentUser}
                  pengajaranList={pengajaranList}
                  references={references}
                  showToast={showToast}
                  onNavigate={handleNavigate}
                />
              )}

              {activePage === 'laporan' && (
                <Laporan
                  token={token}
                  currentUser={currentUser}
                  pengajaranList={pengajaranList}
                  masterAjarData={masterAjarData}
                  references={references}
                  showToast={showToast}
                />
              )}

              {activePage === 'profil' && (
                <Profil
                  token={token}
                  currentUser={currentUser}
                  references={references}
                  onUpdateUser={updated => {
                    setCurrentUser(updated);
                    localStorage.setItem('user', JSON.stringify(updated));
                  }}
                  showToast={showToast}
                  onNavigate={handleNavigate}
                  onBack={() => handleNavigate('dashboard')}
                />
              )}
            </main>

            {/* Mobile Bottom Navigation (Hidden on Dashboard & Profil) */}
            {activePage !== 'dashboard' && activePage !== 'profil' && (
              <BottomNav
                activePage={activePage}
                onNavigate={handleNavigate}
                isMasterAjarLocked={!isMasterAjarComplete}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
